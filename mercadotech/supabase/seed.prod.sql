-- ============================================================================
-- MercadoTech — seed.prod.sql
-- ============================================================================
-- Seed de PRODUCCIÓN — NO es supabase/seed.sql (ese es de laboratorio: 6
-- usuarios falsos, 16 productos, pedidos en los 5 estados — jamás toca
-- producción, decisión 6 de MercadoTech_sesion7.md). Este archivo solo
-- inserta contenido real/genérico que el producto necesita para arrancar:
-- las categorías del catálogo (para que el formulario de "publicar
-- producto" tenga opciones reales) y los artículos de la base de
-- conocimiento del asistente de soporte (RAG, Sesión 4).
--
-- NO inserta usuarios ni productos falsos — el primer vendedor y el primer
-- producto de producción los crea un usuario real, a través de la UI
-- (parte del smoke test de la Fase 7.5, ver docs/DEPLOY.md §3).
--
-- Cómo correrlo (una sola vez, manual — no es una migración, no se corre
-- con `supabase db push`): Supabase dashboard del proyecto de producción →
-- SQL Editor → pegar este archivo completo → Run. Después de correrlo,
-- indexar el contenido para el RAG:
--   HUGGINGFACEHUB_API_TOKEN=... NEXT_PUBLIC_SUPABASE_URL=... \
--   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/index-all.ts
-- (valores reales de producción, solo en la terminal — nunca en un commit
-- ni pegados en el chat).
-- ============================================================================

-- ============================================================
-- CATEGORIES (8) — mismas que supabase/seed.sql, son taxonomía del
-- catálogo, no datos de prueba.
-- ============================================================
insert into public.categories (id, name, slug) values
  ('d0000000-0000-0000-0000-000000000001', 'Laptops', 'laptops'),
  ('d0000000-0000-0000-0000-000000000002', 'Smartphones', 'smartphones'),
  ('d0000000-0000-0000-0000-000000000003', 'Componentes de PC', 'componentes-pc'),
  ('d0000000-0000-0000-0000-000000000004', 'Audio', 'audio'),
  ('d0000000-0000-0000-0000-000000000005', 'Gaming', 'gaming'),
  ('d0000000-0000-0000-0000-000000000006', 'Monitores', 'monitores'),
  ('d0000000-0000-0000-0000-000000000007', 'Accesorios', 'accesorios'),
  ('d0000000-0000-0000-0000-000000000008', 'Redes', 'redes')
on conflict (id) do nothing;

-- ============================================================
-- SUPPORT_ARTICLES (10: 3 envíos, 3 pagos, 2 devoluciones, 2 cuenta) —
-- mismo contenido real que supabase/seed.sql (es contenido genérico de
-- FAQ de un marketplace, no datos de prueba de usuarios/pedidos falsos).
-- ============================================================
insert into public.support_articles (id, title, content, category, is_published) values
  ('50000000-0000-0000-0000-000000000001', '¿Cuánto demora el envío de mi pedido?',
   'El tiempo de entrega depende de tu ubicación. Para Lima Metropolitana, los pedidos suelen llegar entre 2 y 4 días hábiles después de la confirmación del pago. Para provincias, el plazo estimado es de 4 a 8 días hábiles, dependiendo del operador logístico y la zona de destino.

En temporadas de alta demanda, como campañas o fechas festivas, estos plazos pueden extenderse hasta 2 días adicionales. Te recomendamos revisar el estado de tu pedido desde la sección "Mis pedidos", donde se actualiza el estado conforme avanza: pendiente, pagado, enviado y entregado.

Si tu pedido lleva más tiempo del estimado sin cambiar de estado, puedes abrir un ticket de soporte indicando el número de pedido para que lo revisemos.',
   'envíos', true),
  ('50000000-0000-0000-0000-000000000002', '¿Cuánto cuesta el envío?',
   'El costo de envío se calcula automáticamente al finalizar la compra, según tu distrito o ciudad de entrega y el peso/volumen de los productos comprados. En Lima Metropolitana, los envíos suelen costar entre $ 15.000 y $ 35.000 según la zona.

Para compras superiores a $ 300.000 en un mismo pedido, el envío es gratuito dentro de Lima Metropolitana. En provincias, el costo varía según el operador logístico disponible en tu zona y se muestra antes de confirmar la compra, nunca después.

Si compras productos de más de un vendedor en el mismo carrito, el sistema puede generar más de un pedido si los tiempos o costos de envío difieren entre vendedores.',
   'envíos', true),
  ('50000000-0000-0000-0000-000000000003', '¿Cómo hago seguimiento a mi pedido?',
   'Puedes seguir el estado de tu pedido en todo momento desde "Mis pedidos" en tu cuenta. Ahí verás el estado actual (pendiente, pagado, enviado, entregado o cancelado) y la fecha estimada de entrega.

Cuando el vendedor marca tu pedido como "enviado", en muchos casos se agrega un código de seguimiento del operador logístico, si el servicio contratado lo incluye. Este código te permite ver el recorrido del paquete directamente en la web del courier.

Si tienes dudas sobre el avance de tu pedido y no ves actualizaciones por varios días, comunícate con el vendedor a través de la sección de preguntas del producto o abre un ticket de soporte.',
   'envíos', true),
  ('50000000-0000-0000-0000-000000000004', '¿Qué métodos de pago aceptan?',
   'MercadoTech acepta tarjetas de crédito y débito (Visa, Mastercard) procesadas de forma segura, así como pago contra entrega en distritos seleccionados de Lima Metropolitana, sujeto a confirmación del vendedor.

También ofrecemos la opción de pago en cuotas con tarjetas de crédito participantes, mostrada directamente al finalizar la compra, cuando el banco emisor lo permite. El monto de las cuotas y los intereses aplicables los define tu entidad bancaria, no MercadoTech.

Todos los pagos con tarjeta se procesan mediante una pasarela cifrada; en ningún caso el número completo de tu tarjeta queda almacenado en nuestros servidores.',
   'pagos', true),
  ('50000000-0000-0000-0000-000000000005', '¿Es seguro pagar con tarjeta en MercadoTech?',
   'Sí. Todas las transacciones con tarjeta pasan por una pasarela de pago certificada que cifra tus datos de extremo a extremo. MercadoTech nunca almacena el número completo de tu tarjeta ni el código de seguridad (CVV).

Si notas un cargo que no reconoces, repórtalo de inmediato tanto a tu banco como a nuestro equipo de soporte mediante un ticket, indicando la fecha, el monto y el número de pedido si corresponde.

Como medida adicional, algunas compras de montos altos pueden requerir una verificación extra por parte de tu banco antes de confirmarse.',
   'pagos', true),
  ('50000000-0000-0000-0000-000000000006', '¿Puedo pagar contra entrega?',
   'El pago contra entrega está disponible solo para algunos distritos de Lima Metropolitana y depende de que el vendedor lo tenga habilitado para ese producto específico. Verás esta opción al finalizar la compra, únicamente si aplica a tu dirección y a los productos del carrito.

Al recibir el pedido, el repartidor cobra el monto exacto indicado en el pedido; te recomendamos tener el monto aproximado a la mano para agilizar la entrega.

Si el pedido incluye productos de distintos vendedores y no todos aceptan pago contra entrega, el sistema te pedirá elegir otro método de pago para completar la compra.',
   'pagos', true),
  ('50000000-0000-0000-0000-000000000007', '¿Cómo solicito la devolución de un producto?',
   'Tienes hasta 7 días calendario desde que el pedido se marca como "entregado" para solicitar una devolución, siempre que el producto esté en las mismas condiciones en que lo recibiste, con su empaque original y accesorios completos.

Para iniciar el proceso, abre un ticket de soporte indicando el número de pedido, el producto y el motivo de la devolución. Nuestro equipo coordina la recolección con el vendedor y te confirma los siguientes pasos por el mismo canal.

Una vez que el vendedor confirma la recepción y verifica el estado del producto, el reembolso se procesa al mismo método de pago original en un plazo de 5 a 10 días hábiles.',
   'devoluciones', true),
  ('50000000-0000-0000-0000-000000000008', '¿Qué productos no admiten devolución?',
   'Por motivos de higiene y seguridad, algunos productos no admiten devolución una vez abiertos, como audífonos in-ear y ciertos accesorios personales, salvo que presenten una falla de fábrica comprobable.

Los productos reacondicionados y de segunda mano (marcados como "usado" o "reacondicionado") tienen una política de devolución más corta, de 3 días calendario, y solo proceden por fallas técnicas no informadas en la publicación original.

En todos los casos de falla de fábrica, el vendedor es responsable de la reparación, reemplazo o reembolso, según corresponda, sin costo adicional para el comprador.',
   'devoluciones', true),
  ('50000000-0000-0000-0000-000000000009', '¿Cómo creo o verifico mi cuenta?',
   'Para crear una cuenta necesitas un correo electrónico válido y una contraseña. Después del registro, te enviamos un correo de verificación; algunas funciones, como publicar productos si eres vendedor, requieren que confirmes tu correo antes de habilitarse.

Puedes completar tu perfil agregando tu nombre visible, número de teléfono y foto de perfil desde la sección "Mi cuenta". Esta información ayuda a que compradores y vendedores generen más confianza entre sí durante una compraventa.

Si te registraste con un correo incorrecto, contáctanos por un ticket de soporte para actualizarlo; por seguridad, este cambio no se puede hacer directamente desde el perfil.',
   'cuenta', true),
  ('50000000-0000-0000-0000-000000000010', 'Olvidé mi contraseña, ¿cómo la recupero?',
   'En la pantalla de inicio de sesión, selecciona la opción "¿Olvidaste tu contraseña?" e ingresa el correo con el que te registraste. Te enviaremos un enlace para crear una nueva contraseña, válido por un tiempo limitado.

Si no recibes el correo en unos minutos, revisa tu carpeta de spam o promociones. Si el problema persiste, verifica que estés usando el mismo correo con el que creaste la cuenta.

Por seguridad, evita reutilizar contraseñas de otros servicios y usa una combinación de letras, números y símbolos. Si sospechas que alguien más accedió a tu cuenta, cambia tu contraseña de inmediato y contáctanos por un ticket de soporte.',
   'cuenta', true)
on conflict (id) do nothing;
