import { stdin, stdout } from "node:process";
import { createInterface, emitKeypressEvents } from "node:readline";

import pg from "pg";

import { hashPassword, MINIMUM_PASSWORD_LENGTH } from "../src/infrastructure/auth/password.ts";
import {
  databaseSsl,
  isLocalDatabaseHost,
  parseDatabaseEnv,
} from "../src/infrastructure/config/database-env.ts";

class OperatorError extends Error {}

function prompt(question) {
  const interface_ = createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => {
    interface_.question(question, (answer) => {
      interface_.close();
      resolve(answer);
    });
  });
}

function promptHidden(question) {
  if (!stdin.isTTY || !stdout.isTTY || !stdin.setRawMode) {
    throw new OperatorError("La contraseña requiere una terminal interactiva");
  }

  stdout.write(question);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const onKeypress = (character, key) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new OperatorError("Operación cancelada"));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        stdout.write("\n");
        cleanup();
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }
      if (character && !key.ctrl) {
        value += character;
      }
    };
    const cleanup = () => {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("keypress", onKeypress);
  });
}

function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    throw new OperatorError("Correo inválido");
  }
  return email;
}

async function readPassword() {
  const password = await promptHidden("Contraseña: ");
  const repeatedPassword = await promptHidden("Repite la contraseña: ");
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new OperatorError(`La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres`);
  }
  if (password.length > 256 || /\p{Cc}/u.test(password)) {
    throw new OperatorError("La contraseña no puede superar 256 caracteres ni contener caracteres de control");
  }
  if (password !== repeatedPassword) {
    throw new OperatorError("Las contraseñas no coinciden");
  }
  return password;
}

async function createAdmin(client, input) {
  const result = await client.query(
    `INSERT INTO admin_users (email, email_normalized, display_name, role, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [input.email, input.email, input.displayName, input.role, input.passwordHash],
  );
  return { adminId: result.rows[0].id, action: "ADMIN_CREATED" };
}

async function resetPassword(client, input) {
  const result = await client.query(
    `UPDATE admin_users
        SET password_hash = $2, failed_sign_in_count = 0, locked_until = NULL, updated_at = now()
      WHERE email_normalized = $1
      RETURNING id`,
    [input.email, input.passwordHash],
  );
  if (!result.rows[0]) {
    throw new OperatorError("No existe esa cuenta");
  }
  const adminId = result.rows[0].id;
  await client.query("DELETE FROM admin_sessions WHERE admin_user_id = $1", [adminId]);
  return { adminId, action: "ADMIN_PASSWORD_RESET" };
}

async function deactivateAdmin(client, input) {
  const result = await client.query(
    `UPDATE admin_users SET is_active = false, updated_at = now()
      WHERE email_normalized = $1 RETURNING id`,
    [input.email],
  );
  if (!result.rows[0]) {
    throw new OperatorError("No existe esa cuenta");
  }
  const adminId = result.rows[0].id;
  await client.query("DELETE FROM admin_sessions WHERE admin_user_id = $1", [adminId]);
  return { adminId, action: "ADMIN_DEACTIVATED" };
}

async function main() {
  const args = process.argv.slice(2);
  const confirmRemote = args.includes("--confirm-remote");
  const [command, emailArgument, ...extra] = args.filter((argument) => argument !== "--confirm-remote");
  if (
    !["create", "reset-password", "deactivate"].includes(command) ||
    extra.length > 0 ||
    (command === "create" ? emailArgument !== undefined : !emailArgument)
  ) {
    throw new OperatorError("Uso: npm run admin -- create|reset-password <correo>|deactivate <correo> [--confirm-remote]");
  }

  const environment = parseDatabaseEnv(process.env);
  const target = new URL(environment.DATABASE_URL);
  if (!isLocalDatabaseHost(target.hostname) && !confirmRemote) {
    throw new OperatorError("La base de datos no es local; vuelve a ejecutar con --confirm-remote");
  }

  const input = {};
  if (command === "create") {
    input.email = normalizeEmail(await prompt("Correo: "));
    input.displayName = (await prompt("Nombre para mostrar: ")).trim();
    if (!input.displayName || input.displayName.length > 60 || /\p{Cc}/u.test(input.displayName)) {
      throw new OperatorError("El nombre debe tener entre 1 y 60 caracteres sin caracteres de control");
    }
    input.role = (await prompt("Rol (OWNER o ADMIN): ")).trim();
    if (input.role !== "OWNER" && input.role !== "ADMIN") {
      throw new OperatorError("El rol debe ser OWNER o ADMIN");
    }
    input.passwordHash = await hashPassword(await readPassword());
  } else {
    input.email = normalizeEmail(emailArgument);
    if (command === "reset-password") {
      input.passwordHash = await hashPassword(await readPassword());
    }
  }

  const client = new pg.Client({
    connectionString: environment.DATABASE_URL,
    connectionTimeoutMillis: 3_000,
    ssl: databaseSsl(environment),
  });
  try {
    await client.connect();
    await client.query("BEGIN");
    try {
      let result;
      if (command === "create") {
        result = await createAdmin(client, input);
      } else if (command === "reset-password") {
        result = await resetPassword(client, input);
      } else {
        result = await deactivateAdmin(client, input);
      }
      await client.query(
        `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata)
         VALUES (NULL, $1, 'admin_user', $2, '{"via":"cli"}'::jsonb)`,
        [result.action, result.adminId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    stdout.write("Operación completada.\n");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof OperatorError ? error.message : "Error de configuración o base de datos.");
  process.exitCode = 1;
});
