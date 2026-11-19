import type { Metadata } from "next";
import { PaginaLegal } from "@/components/legal/PaginaLegal";

export const metadata: Metadata = {
  title: "Aviso de privacidad · drmrs archive",
};

export default function AvisoDePrivacidadPage() {
  return (
    <PaginaLegal titulo="Aviso de privacidad" actualizacion="04 noviembre 2026">

        <h2>Quién es responsable de tus datos</h2>
        <p>
          Joshua Lopez Garcia, con domicilio en Santiago de Querétaro,
          Querétaro, México, es responsable del tratamiento de los datos
          personales que nos compartes en el registro de drmrs archive
          (drmr.com.mx). Contacto:{" "}
          <a href="mailto:drmrstudiosmx@gmail.com">drmrstudiosmx@gmail.com</a>.
        </p>

        <h2>Qué datos pedimos</h2>
        <ul>
          <li>Nombre.</li>
          <li>Número de WhatsApp.</li>
          <li>Correo electrónico (opcional).</li>
          <li>Usuario de Instagram.</li>
          <li>
            Talla de ropa y, si quieres, el nombre de alguien que te gustaría
            ver en el archivo.
          </li>
          <li>La red o página desde la que llegaste al registro.</li>
        </ul>
        <p>No pedimos datos sensibles ni financieros en este registro.</p>

        <h2>Para qué los usamos</h2>
        <p>
          <b>Finalidades principales:</b>
        </p>
        <ul>
          <li>Registrarte en drmrs archive y darte un número de registro.</li>
          <li>
            Avisarte por WhatsApp o correo antes que al público sobre la
            apertura de preventas y lanzamientos (drops) de drmr.
          </li>
          <li>Calcular cuántas piezas producir y en qué tallas.</li>
        </ul>
        <p>
          <b>Finalidad secundaria:</b> enviarte contenido de drmrs archive y
          novedades de la marca. Si no quieres que tus datos se usen para esto,
          escríbenos a{" "}
          <a href="mailto:drmrstudiosmx@gmail.com">drmrstudiosmx@gmail.com</a> y
          lo dejamos de hacer, sin que eso afecte tu registro.
        </p>

        <h2>Con quién los compartimos</h2>
        <p>
          No vendemos ni compartimos tus datos con terceros para sus propios
          fines. Se guardan en herramientas que usamos para operar (Google
          Workspace para la lista y, cuando abra la tienda, Shopify y WhatsApp
          Business), que los tratan por nuestra cuenta.
        </p>

        <h2>Tus derechos (ARCO)</h2>
        <p>
          Puedes pedir en cualquier momento acceder a tus datos, corregirlos,
          cancelarlos u oponerte a su uso, así como retirar tu consentimiento.
          Escríbenos a{" "}
          <a href="mailto:drmrstudiosmx@gmail.com">drmrstudiosmx@gmail.com</a>{" "}
          con tu nombre, tu número de WhatsApp registrado y lo que quieres que
          hagamos. Te respondemos en un máximo de 20 días hábiles. También
          puedes pedir que te borremos respondiendo “BAJA” a cualquier mensaje
          nuestro por WhatsApp.
        </p>

        <h2>Cambios a este aviso</h2>
        <p>
          Si cambia este aviso, publicaremos la versión nueva en esta misma
          página con su fecha de actualización.
        </p>
    </PaginaLegal>
  );
}
