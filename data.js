// ═══════════════════════════════════════════════════════
// DATOS DEL PROYECTO · Estrategias de IA 2026
// Semana 1 = 16 de marzo de 2026
// ═══════════════════════════════════════════════════════

const SEMANAS_F1 = [
  "16/3","23/3","30/3","6/4","13/4","20/4",
  "27/4","4/5","11/5","18/5","25/5","1/6"
];

const MESES_POSTERIORES = [
  { label:"Jun", fase:2 }, { label:"Jul", fase:2 }, { label:"Ago", fase:2 },
  { label:"Sep", fase:3 }, { label:"Oct", fase:3 }, { label:"Nov", fase:3 },
  { label:"Dic", fase:4 },
];

const FASES = [
  {
    id:"f1", num:"01", nombre:"Gobernanza y Diagnóstico",
    periodo:"Marzo – Junio 2026",
    objetivo:"Establecer la estructura de toma de decisiones y realizar el diagnóstico basal de la institución.",
    ejes:[
      "Institucionalización: conformación y puesta en marcha de la Mesa de Trabajo sobre IA con designación de enlaces de las áreas clave (Parlamentaria, Administrativa, IT, Legales).",
      "Relevamiento: diagnóstico integral para identificar infraestructura disponible, normativa vigente y procesos cuello de botella operativos.",
      "Validación y Consenso: consultas con expertos externos y taller de sensibilización para definir expectativas y alinear la visión política con estándares técnicos sólidos."
    ],
    t_start:0, t_end:11, tipo:"semanas"
  },
  {
    id:"f2", num:"02", nombre:"Estrategia y Marco Normativo",
    periodo:"Junio – Agosto 2026",
    objetivo:"Crear las reglas del juego, formalizar la estrategia y capacitar al capital humano.",
    ejes:[
      "Normativa: confección del Protocolo de uso ético con principios claros de transparencia, privacidad y supervisión humana obligatoria.",
      "Estrategia y Vinculación: formalización del Libro Blanco y rondas de vinculación con universidades y sector privado para nutrir el proceso.",
      "Capacitación: despliegue del plan de formación para nivelar el conocimiento de toda la planta y reducir la resistencia al cambio."
    ],
    t_start:0, t_end:2, tipo:"meses"
  },
  {
    id:"f3", num:"03", nombre:"Desarrollo de Pilotos",
    periodo:"Septiembre – Noviembre 2026",
    objetivo:"Definición estratégica, prototipado y validación de soluciones en entorno controlado.",
    ejes:[
      "Prototipado e Implementación: selección estratégica y desarrollo funcional de herramientas, pasando del análisis de casos comparados a soluciones tangibles.",
      "Estandarización Operativa: creación de guías prácticas y biblioteca de prompts institucional para uso eficiente y homogéneo.",
      "Formación Avanzada: trayectos formativos segmentados por roles (legisladores, funcionarios, técnicos) para profundizar capacidades específicas."
    ],
    t_start:3, t_end:5, tipo:"meses"
  },
  {
    id:"f4", num:"04", nombre:"Evaluación y Cierre",
    periodo:"Diciembre 2026",
    objetivo:"Medir el impacto del ciclo y proyectar la hoja de ruta para el siguiente año legislativo.",
    ejes:[
      "Informe de Gestión: balance anual detallado que permite evaluar el cumplimiento de hitos y analizar la propuesta futura.",
      "Planificación 2027: diseño de la hoja de ruta y esquema de gastos, fundamentando la inversión en licencias, hardware y nuevos desarrollos."
    ],
    t_start:6, t_end:6, tipo:"meses"
  }
];

const PRODUCTOS_F1 = [
  {
    id:"f1p1", num:"01", nombre:"Asesoramiento Experto",
    desc:"Consultas técnicas cerradas con especialistas para validar el diagnóstico inicial y alimentar la visión estratégica de las autoridades de la Cámara.",
    hito:{ nombre:"Informe de visión estratégica", fecha:"Semana del 6 de abril" },
    t_start:1, t_end:3,
    subproductos:[
      { id:"f1p1s1", nombre:"Reuniones con especialistas en modernización parlamentaria y administración pública", t_start:1, t_end:3, es_hito:false },
      { id:"f1p1s2", nombre:"Benchmarking con otras legislaturas: casos de éxito y estándares globales", t_start:1, t_end:3, es_hito:false },
      { id:"f1p1h1", nombre:"Informe de visión estratégica", fecha:"Semana del 6 de abril", t_start:3, t_end:3, es_hito:true }
    ]
  },
  {
    id:"f1p2", num:"02", nombre:"Jornada de Sensibilización",
    desc:"Taller inicial para legisladores y directivos sobre mitos, riesgos y potencial de la IA. Instala la agenda institucional y nivela expectativas internas.",
    hito:{ nombre:"Taller realizado", fecha:"Semana del 13 de abril" },
    t_start:1, t_end:4,
    subproductos:[
      { id:"f1p2s1", nombre:"Diseño de la jornada: dinámica, invitados y logística con ceremonial", t_start:1, t_end:3, es_hito:false },
      { id:"f1p2h1", nombre:"Taller realizado", fecha:"Semana del 13 de abril", t_start:4, t_end:4, es_hito:true }
    ]
  },
  {
    id:"f1p3", num:"03", nombre:"Mesa de Trabajo de IA",
    desc:"Órgano interno interdisciplinario que legitima y valida la estrategia institucional. Integra enlaces de Parlamentaria, IT, Legales y Prensa.",
    hito:{ nombre:"1ra reunión de la Mesa", fecha:"Semana del 20 de abril" },
    t_start:2, t_end:11,
    subproductos:[
      { id:"f1p3s1", nombre:"Diseño: integrantes, dinámica, frecuencia, agenda y objetivos de la Mesa", t_start:2, t_end:4, es_hito:false },
      { id:"f1p3h1", nombre:"1ra reunión de la Mesa", fecha:"Semana del 20 de abril", t_start:5, t_end:5, es_hito:true },
      { id:"f1p3s2", nombre:"Reuniones quincenales de seguimiento y validación de avances", t_start:5, t_end:11, es_hito:false }
    ]
  },
  {
    id:"f1p4", num:"04", nombre:"Informe de Situación",
    desc:"Diagnóstico del estado tecnológico, normativo y de procesos de la Legislatura. Identifica brechas y formula recomendaciones de corto plazo.",
    hito:{ nombre:"Informe final presentado", fecha:"Semana del 11 de mayo" },
    t_start:1, t_end:8,
    subproductos:[
      { id:"f1p4s1", nombre:"1.1 Diseño del instrumento: mapeo de actores, matriz de evaluación e indicadores de éxito", t_start:1, t_end:2, es_hito:false },
      { id:"f1p4s2", nombre:"1.2 Relevamiento: entrevistas (áreas administrativas avanzadas), flujograma y análisis de calidad de datos", t_start:3, t_end:5, es_hito:false },
      { id:"f1p4s3", nombre:"1.3 Análisis: hallazgos clave, detección de brechas y recomendaciones", t_start:6, t_end:8, es_hito:false },
      { id:"f1p4h1", nombre:"Informe final presentado", fecha:"Semana del 11 de mayo", t_start:8, t_end:8, es_hito:true }
    ]
  },
  {
    id:"f1p5", num:"05", nombre:"Encuesta de Uso de IA",
    desc:"Herramienta clave para la toma de decisiones, orientada a conocer el estado de situación interno, identificar oportunidades y anticipar desafíos.",
    hito:{ nombre:"Informe de resultados", fecha:"Semanas del 18 y 25 de mayo" },
    t_start:3, t_end:9,
    subproductos:[
      { id:"f1p5s1", nombre:"4.1 Diseño de la encuesta y metodología", t_start:3, t_end:5, es_hito:false },
      { id:"f1p5s2", nombre:"4.2 Realización de la encuesta", t_start:6, t_end:8, es_hito:false },
      { id:"f1p5s3", nombre:"4.3 Análisis de resultados", t_start:9, t_end:9, es_hito:false },
      { id:"f1p5h1", nombre:"Informe de resultados", fecha:"Semanas del 18 y 25 de mayo", t_start:9, t_end:9, es_hito:true }
    ]
  }
];

const PRODUCTOS_F2 = [
  { id:"f2p1", nombre:"Rondas de vinculación (universidades, OSC, sector privado, organismos internacionales)", t_start:0, t_end:2, t_hito:2, hito:{ nombre:"Minutas de acuerdos y gestión institucional", fecha:"Ago 2026" } },
  { id:"f2p2", nombre:"Protocolo de ética y uso responsable de IA", t_start:0, t_end:2, t_hito:2, hito:{ nombre:"Protocolo redactado y listo para presentar", fecha:"Ago 2026" } },
  { id:"f2p3", nombre:"Libro Blanco de IA de la Cámara", t_start:1, t_end:2, t_hito:2, hito:{ nombre:"Libro Blanco aprobado", fecha:"Ago 2026" } },
  { id:"f2p4", nombre:"Formación general del personal (conceptos básicos de IA)", t_start:0, t_end:2, t_hito:null, hito:null },
];

const PRODUCTOS_F3 = [
  { id:"f3p1", nombre:"Selección estratégica de casos de uso viables", t_start:3, t_end:3, t_hito:null, hito:null },
  { id:"f3p2", nombre:"Prototipado y desarrollo funcional de pilotos", t_start:3, t_end:5, t_hito:5, hito:{ nombre:"Prototipo funcional entregado", fecha:"Nov 2026" } },
  { id:"f3p3", nombre:"Manual operativo y biblioteca de prompts institucional", t_start:3, t_end:5, t_hito:null, hito:null },
  { id:"f3p4", nombre:"Formación avanzada por roles (legisladores, funcionarios, IT)", t_start:3, t_end:5, t_hito:null, hito:null },
];

const PRODUCTOS_F4 = [
  { id:"f4p1", nombre:"Informe de gestión anual con métricas de impacto", t_start:6, t_end:6, t_hito:6, hito:{ nombre:"Informe de gestión presentado", fecha:"Dic 2026" } },
  { id:"f4p2", nombre:"Planificación y hoja de ruta 2027", t_start:6, t_end:6, t_hito:6, hito:{ nombre:"Presupuesto 2027 aprobado", fecha:"Dic 2026" } },
];

const TODOS_LOS_HITOS = [
  { id:"h1", nombre:"Informe de visión estratégica", fecha:"Semana del 6 de abril", mes:"Abril", dia:"6/4", fase:"Fase 1", producto:"Asesoramiento Experto", taskId:"f1p1h1" },
  { id:"h2", nombre:"Taller de sensibilización realizado", fecha:"Semana del 13 de abril", mes:"Abril", dia:"13/4", fase:"Fase 1", producto:"Jornada de Sensibilización", taskId:"f1p2h1" },
  { id:"h3", nombre:"1ra reunión de la Mesa de Trabajo", fecha:"Semana del 20 de abril", mes:"Abril", dia:"20/4", fase:"Fase 1", producto:"Mesa de Trabajo de IA", taskId:"f1p3h1" },
  { id:"h4", nombre:"Informe de situación presentado", fecha:"Semana del 11 de mayo", mes:"Mayo", dia:"11/5", fase:"Fase 1", producto:"Informe de Situación", taskId:"f1p4h1" },
  { id:"h5", nombre:"Informe de resultados de encuesta", fecha:"Semanas del 18 y 25 de mayo", mes:"Mayo", dia:"18/5", fase:"Fase 1", producto:"Encuesta de Uso de IA", taskId:"f1p5h1" },
  { id:"h6", nombre:"Protocolo de ética aprobado", fecha:"Agosto 2026", mes:"Agosto", dia:null, fase:"Fase 2", producto:"Protocolo de ética", taskId:"f2p2" },
  { id:"h7", nombre:"Libro Blanco aprobado", fecha:"Agosto 2026", mes:"Agosto", dia:null, fase:"Fase 2", producto:"Libro Blanco", taskId:"f2p3" },
  { id:"h8", nombre:"Prototipo funcional entregado", fecha:"Noviembre 2026", mes:"Noviembre", dia:null, fase:"Fase 3", producto:"Desarrollo de Pilotos", taskId:"f3p2" },
  { id:"h9", nombre:"Informe de gestión anual", fecha:"Diciembre 2026", mes:"Diciembre", dia:null, fase:"Fase 4", producto:"Evaluación y Cierre", taskId:"f4p1" },
  { id:"h10", nombre:"Presupuesto 2027 aprobado", fecha:"Diciembre 2026", mes:"Diciembre", dia:null, fase:"Fase 4", producto:"Planificación 2027", taskId:"f4p2" },
];

const ORDEN_MESES_HITOS = ["Abril","Mayo","Agosto","Noviembre","Diciembre"];

// Todas las tasks con su taskId (para calcular porcentajes)
const TODAS_LAS_TASKS = [];
PRODUCTOS_F1.forEach(p => {
  TODAS_LAS_TASKS.push({ id: p.id, faseId:"f1", nombre: p.nombre, tipo:"producto" });
  p.subproductos.forEach(s => TODAS_LAS_TASKS.push({ id: s.id, faseId:"f1", nombre: s.nombre, tipo: s.es_hito ? "hito" : "sub" }));
});
[...PRODUCTOS_F2,...PRODUCTOS_F3,...PRODUCTOS_F4].forEach(p => {
  const fid = p.id.startsWith("f2")?"f2":p.id.startsWith("f3")?"f3":"f4";
  TODAS_LAS_TASKS.push({ id: p.id, faseId: fid, nombre: p.nombre, tipo:"producto" });
});

const ESTADO_INICIAL = {
  version: 1,
  tareas: {},
  actividad: [],
  config: { gistId:"", gistToken:"", editorPassword:"ia2026" }
};
