// ── DEFAULT TEMPLATES ──────────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-1',
    name: 'Propuesta inicial',
    subject: 'Propuesta de página web para {nombre}',
    body: `Estimado/a propietario/a de {nombre},

Me pongo en contacto con usted porque he visto que su {tipo} en {ciudad} no cuenta todavía con página web propia.

Con sus {resenas} reseñas y una valoración de {valoracion}/5 estrellas, su negocio tiene una reputación excelente que merece brillar también en internet.

Desde {agencia} creamos webs profesionales, adaptadas a móviles y con posicionamiento en Google desde {precio} €. Sin permanencia ni letras pequeñas.

¿Le vendría bien una llamada de 10 minutos esta semana para contarle cómo podemos ayudarle?

Un cordial saludo,
{agencia}`
  },
  {
    id: 'tpl-2',
    name: 'Seguimiento 1 (1 semana)',
    subject: 'Re: Propuesta web para {nombre} — ¿tiene un momento?',
    body: `Hola de nuevo,

La semana pasada le envié una propuesta para crear la página web de {nombre} y quería asegurarme de que le llegó correctamente.

Entiendo que está muy ocupado gestionando el día a día de su negocio. Por eso precisamente diseñamos un proceso sencillo: usted nos da el visto bueno y nosotros nos encargamos de todo.

Si prefiere, también podemos hablar por teléfono o en persona. ¿Qué le viene mejor?

Quedo a su disposición,
{agencia}`
  },
  {
    id: 'tpl-3',
    name: 'Seguimiento 2 (última oportunidad)',
    subject: 'Última oportunidad — web para {nombre}',
    body: `Hola,

Sé que los emails de seguimiento pueden ser un poco pesados, así que este será el último.

Solo quería que supiera que la oferta de {precio} € para la web de {nombre} sigue en pie, pero la plaza reservada para este mes se libera el próximo viernes.

Si en algún momento cambia de opinión, aquí estaremos.

Muchas gracias por su tiempo,
{agencia}`
  },
  {
    id: 'tpl-4',
    name: 'Oferta especial',
    subject: '🎁 Oferta especial para {nombre} — 20% de descuento',
    body: `Estimado/a propietario/a de {nombre},

Este mes tenemos una oferta especial para negocios locales de {ciudad}: un 20% de descuento en nuestra web profesional.

Precio habitual: {precio} €
Precio con descuento: {precio_desc} €

La oferta es válida hasta fin de mes. Si le interesa, responda a este email o llámenos directamente.

Un saludo,
{agencia}`
  }
];

// ── DEMO PROSPECTS ──────────────────────────────────────────
const DEMO_PROSPECTS = [
  {
    id: genId(), name: 'Bar La Taberna de Pepe', type: 'Bar', city: 'Madrid',
    address: 'C/ Mayor 14', phone: '+34 912 345 678', email: 'pepe@taberna.com',
    rating: 4.2, reviews: 87, stage: 'contacted', value: 350,
    followupDate: futureDays(2),
    notes: [{ date: todayStr(), text: 'Hablé con Pepe. Está interesado pero quiere ver ejemplos de webs anteriores. Enviarle portfolio.' }],
    createdAt: pastDays(5), lastActivity: pastDays(2)
  },
  {
    id: genId(), name: 'Peluquería Carmen', type: 'Peluquería', city: 'Madrid',
    address: 'Av. de la Paz 32', phone: '+34 913 456 789', email: '',
    rating: 4.6, reviews: 143, stage: 'negotiating', value: 499,
    followupDate: futureDays(5),
    notes: [
      { date: pastDays(10), text: 'Primer contacto por teléfono. Muy interesada.' },
      { date: pastDays(3), text: 'Reunión presencial. Quiere web + cita online. Presupuesto enviado por email.' }
    ],
    createdAt: pastDays(14), lastActivity: pastDays(3)
  },
  {
    id: genId(), name: 'Fontanería Martínez Hnos.', type: 'Fontanero', city: 'Madrid',
    address: 'C/ del Pez 7', phone: '+34 666 123 456', email: 'martinez@fontaneria.es',
    rating: 4.0, reviews: 29, stage: 'radar', value: 299,
    followupDate: futureDays(10),
    notes: [],
    createdAt: pastDays(2), lastActivity: pastDays(2)
  },
  {
    id: genId(), name: 'Clínica Dental Ruiz', type: 'Dentista', city: 'Madrid',
    address: 'Paseo del Prado 18', phone: '+34 916 789 012', email: 'info@dentalruiz.es',
    rating: 4.7, reviews: 98, stage: 'closed', value: 750,
    followupDate: null,
    notes: [
      { date: pastDays(20), text: 'Contacto inicial. Muy profesionales.' },
      { date: pastDays(12), text: 'Reunión. Quieren web completa + blog + formulario de citas.' },
      { date: pastDays(7), text: '¡CERRADO! Firmado contrato por 750€. Inicio el lunes.' }
    ],
    createdAt: pastDays(22), lastActivity: pastDays(7)
  },
  {
    id: genId(), name: 'Taller AutoGonzalez', type: 'Taller mecánico', city: 'Madrid',
    address: 'Polígono Norte, Nave 12', phone: '+34 914 567 890', email: '',
    rating: 3.8, reviews: 54, stage: 'lost', value: 299,
    followupDate: null,
    notes: [{ date: pastDays(8), text: 'No interesado. Dice que sus clientes no usan internet. Cerrado.' }],
    createdAt: pastDays(15), lastActivity: pastDays(8)
  },
  {
    id: genId(), name: 'Frutería La Huerta', type: 'Frutería', city: 'Madrid',
    address: 'Mercado Central, Puesto 8', phone: '+34 677 234 567', email: '',
    rating: 4.8, reviews: 201, stage: 'radar', value: 299,
    followupDate: futureDays(1),
    notes: [],
    createdAt: pastDays(1), lastActivity: pastDays(1)
  },
  {
    id: genId(), name: 'Yoga Studio Serenity', type: 'Yoga', city: 'Madrid',
    address: 'C/ Hortaleza 66', phone: '+34 688 234 567', email: 'hola@serenity.es',
    rating: 4.8, reviews: 112, stage: 'negotiating', value: 599,
    followupDate: futureDays(3),
    notes: [
      { date: pastDays(6), text: 'Primera llamada. Quieren web con horarios, reserva de clases y tienda online de merchandising.' },
      { date: pastDays(1), text: 'Enviado presupuesto detallado. Esperando respuesta.' }
    ],
    createdAt: pastDays(8), lastActivity: pastDays(1)
  },
  {
    id: genId(), name: 'Papelería El Estudiante', type: 'Papelería', city: 'Madrid',
    address: 'C/ Fuencarral 44', phone: '+34 678 345 678', email: '',
    rating: 4.1, reviews: 41, stage: 'contacted', value: 299,
    followupDate: pastDays(1),
    notes: [{ date: pastDays(4), text: 'Contactado por email. Sin respuesta aún.' }],
    createdAt: pastDays(7), lastActivity: pastDays(4)
  }
];

// ── ACTIVITY LOG ────────────────────────────────────────────
const DEMO_ACTIVITY = [
  { text: 'Clínica Dental Ruiz marcado como <strong>Cerrado ✓</strong>', time: pastDays(7), dot: '#059669' },
  { text: 'Email enviado a <strong>Yoga Studio Serenity</strong>', time: pastDays(1), dot: '#2563EB' },
  { text: 'Nota añadida en <strong>Peluquería Carmen</strong>', time: pastDays(3), dot: '#D97706' },
  { text: 'Nuevo prospecto: <strong>Frutería La Huerta</strong>', time: pastDays(1), dot: '#7C3AED' },
  { text: '<strong>Taller AutoGonzalez</strong> marcado como Perdido', time: pastDays(8), dot: '#DC2626' },
];

// ── HELPERS ─────────────────────────────────────────────────
function genId() {
  return 'p_' + Math.random().toString(36).substr(2, 9);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function futureDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function pastDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}
