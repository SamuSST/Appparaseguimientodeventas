/**
 * Test de usuario · App de seguimiento de ventas CDA La 37
 *
 * Crea en Google Forms la encuesta del test de usuario (prueba de usabilidad, V&V)
 * y una hoja de cálculo donde llegan las respuestas.
 *
 * Cómo usarlo:
 *   1. Entra a https://script.google.com y crea un proyecto nuevo.
 *   2. Borra el código de ejemplo, pega todo este archivo y guarda (Ctrl+S).
 *   3. Elige la función "crearTestDeUsuario" y pulsa "Ejecutar". La primera vez pide permisos de Google.
 *   4. En "Registro de ejecución" aparecen los enlaces para responder, editar y ver las respuestas.
 *
 * Contenido (anónimo, sin correo ni datos personales): tipo de usuario (real o potencial), 8 tareas en la app,
 * 12 preguntas cerradas en escala 1–5 y la caja de observaciones/recomendaciones.
 * Mínimo 10 encuestas.
 */

const APP_URL = "https://samusst.github.io/Appparaseguimientodeventas/";

// Tareas que el participante hace en la app antes de responder la encuesta.
const TAREAS = [
  "Iniciar sesión con la cuenta que se le entregó",
  "Encontrar su meta del mes y cuánto le falta para cumplirla",
  "Buscar un cliente por su placa en la lista de clientes",
  "Registrar una atención nueva (cliente, placa, vehículo y revisión)",
  "Registrar una visita del recorrido con ubicación y foto",
  "En Seguimiento, encontrar un cliente que deba volver a la reinspección",
  "Abrir el botón de WhatsApp de un cliente por renovar (sin enviar el mensaje)",
  "Ver su posición en el ranking de vendedores",
];

// 12 preguntas cerradas, escala 1 (Muy en desacuerdo) a 5 (Muy de acuerdo).
const PREGUNTAS = [
  "Fue fácil iniciar sesión en la app.",
  "Entendí rápidamente lo que muestra el panel principal (metas y cumplimiento).",
  "Los gráficos me ayudan a entender mi desempeño.",
  "Encontrar a un cliente por su placa o su nombre fue fácil.",
  "Registrar una atención fue rápido y claro.",
  "Registrar una visita del recorrido (ubicación y foto) fue sencillo.",
  "La sección Seguimiento me deja claro a qué clientes debo llamar.",
  "Los botones Llamar y WhatsApp funcionaron como esperaba.",
  "Los mensajes de confirmación y de error fueron claros.",
  "La app se ve y funciona bien en el celular.",
  "Los textos, colores y botones son coherentes en todas las pantallas.",
  "En general, recomendaría usar esta app en el CDA.",
];

function crearTestDeUsuario() {
  const form = FormApp.create("Test de usuario · App de seguimiento de ventas CDA La 37");
  form
    .setDescription(
      "Prueba de usabilidad (verificación y validación) de la app de seguimiento de ventas del CDA La 37.\n\n" +
        "Primero realiza las tareas en la app (" + APP_URL + ") y luego responde. " +
        "Es anónima: no pide correo ni datos personales. No hay respuestas buenas ni malas: evaluamos la app, no a ti. Toma unos 10 minutos."
    )
    .setProgressBar(true)
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setConfirmationMessage("¡Gracias! Tus respuestas nos ayudan a mejorar la app.");

  // Encuesta anónima: no pide correo, nombre ni datos personales.
  // Solo se pregunta si es usuario real o potencial, que es lo que pide la prueba.
  form
    .addMultipleChoiceItem()
    .setTitle("Tipo de usuario")
    .setHelpText("Real: usa o usará la app en el CDA. Potencial: podría usarla (otro CDA, estudiante, conocido).")
    .setChoiceValues(["Usuario real", "Usuario potencial"])
    .setRequired(true);

  // 1. Tareas: lo marca el participante (o quien observa la prueba)
  form.addPageBreakItem().setTitle("1. Tareas en la app").setHelpText("Marca cómo te fue con cada tarea.");

  form
    .addGridItem()
    .setTitle("¿Pudiste completar cada tarea?")
    .setRows(TAREAS)
    .setColumns(["Sí, sin ayuda", "Sí, con ayuda", "No pude", "No aplica a mi rol"])
    .setRequired(true);

  form
    .addMultipleChoiceItem()
    .setTitle("¿Cuánto tiempo te tomó hacer todas las tareas?")
    .setChoiceValues(["Menos de 5 minutos", "Entre 5 y 10 minutos", "Entre 10 y 15 minutos", "Más de 15 minutos"])
    .setRequired(true);

  // 2. Experiencia de uso: 12 preguntas cerradas, escala 1–5
  form
    .addPageBreakItem()
    .setTitle("2. Experiencia de uso")
    .setHelpText("Califica de 1 a 5: 1 = Muy en desacuerdo, 3 = Neutral, 5 = Muy de acuerdo.");

  PREGUNTAS.forEach(function (pregunta, i) {
    form
      .addScaleItem()
      .setTitle(i + 1 + ". " + pregunta)
      .setBounds(1, 5)
      .setLabels("Muy en desacuerdo", "Muy de acuerdo")
      .setRequired(true);
  });

  // 3. Caja de observaciones / recomendaciones
  form.addPageBreakItem().setTitle("3. Observaciones y recomendaciones");

  form
    .addParagraphTextItem()
    .setTitle("Observaciones / recomendaciones")
    .setHelpText("¿Qué te costó trabajo, qué cambiarías o qué le agregarías a la app?");

  // Hoja de cálculo donde llegan las respuestas
  const hoja = SpreadsheetApp.create("Respuestas · Test de usuario CDA La 37");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, hoja.getId());

  Logger.log("Formulario para responder: " + form.getPublishedUrl());
  Logger.log("Formulario para editar:    " + form.getEditUrl());
  Logger.log("Hoja de respuestas:        " + hoja.getUrl());
}
