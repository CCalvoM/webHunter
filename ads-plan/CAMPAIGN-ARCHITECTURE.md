# WebHunter CRM — Arquitectura de Campañas Meta

---

## Convención de nombres

```
WH_[OBJETIVO]_[AUDIENCIA]_[FECHA]
```

Ejemplos:
- `WH_CONV_FreelancersES_2026Q3`
- `WH_RETARG_WebVisitors30d_2026Q3`

---

## Estructura completa — Fase 1

```
Cuenta Meta Ads
│
├── Campaña 1: WH_CONV_Prospecting_2026Q3
│   Objetivo: Conversiones (evento: suscripción/registro)
│   Presupuesto: 200 €/mes (nivel campaña, Advantage+ Budget)
│   Estrategia puja: Lowest Cost (sin cap en fase de aprendizaje)
│   │
│   ├── Ad Set A: Títulos de trabajo
│   │   Segmentación: España | 22–45 años
│   │   Intereses/títulos: "Diseñador web", "Desarrollador web", "Freelance",
│   │                       "Diseño gráfico", "Web designer", "Front-end developer"
│   │   Ubicaciones: Feed + Reels (Instagram + Facebook)
│   │   Presupuesto: ~100 €/mes (Advantage+ distribuye automáticamente)
│   │   Creatividad: Vídeo demo 30–60s
│   │
│   ├── Ad Set B: Intereses freelance + negocio digital
│   │   Segmentación: España | 22–45 años
│   │   Intereses: "Freelancing", "Emprendimiento", "Marketing digital",
│   │               "Diseño de páginas web", "Agencia de marketing"
│   │   Ubicaciones: Feed + Reels (Instagram + Facebook)
│   │   Presupuesto: ~70 €/mes
│   │   Creatividad: Carrusel "pain → solución"
│   │
│   └── Ad Set C: Broad (lookalike habilitado una vez tengas 50+ eventos)
│       Segmentación: España | 22–50 años | sin intereses (Meta AI)
│       Activar: solo cuando tengas 50+ conversiones en cuenta
│       Creatividad: Static con oferta / testimonial
│
└── Campaña 2: WH_RETARG_Visitors_2026Q3
    Objetivo: Conversiones
    Presupuesto: 50 €/mes
    Estrategia puja: Lowest Cost
    │
    └── Ad Set: Visitantes web 30 días
        Audiencia personalizada: Todos los visitantes de la landing (últimos 30 días)
        Exclusión: Suscriptores actuales
        Creatividad: Static "¿Todavía pensándolo?" + oferta urgencia
```

---

## Creatividades por ad set

| Ad Set | Formato | Duración/Spec | Mensaje clave |
|--------|---------|--------------|---------------|
| A (Títulos trabajo) | Vídeo vertical | 30–45s, 9:16 | Demo directa de la herramienta |
| B (Intereses freelance) | Carrusel 4–6 slides | 1080×1080 | Pain → Solución → CTA |
| C (Broad) | Static image | 1080×1080 o 1080×1920 | Oferta o testimonial |
| Retargeting | Static image | 1080×1080 | Urgencia + descuento |

---

## Configuración técnica de cada campaña

### Campaña de Prospecting

```
Objetivo de campaña:  Conversiones
Evento de conversión: [nombre del evento que configuraste en el Pixel]
Atribución:           7-day click / 1-day view (Meta default)
Ubicaciones:          Automatic Placements (Advantage+)
                      ⚠️ Excluir: Audience Network si CPA sube mucho
Programación:         Continua (sin restricción de horario)
Budget optimization:  Campaign Budget Optimization (CBO) activado
```

### Campaña de Retargeting

```
Objetivo de campaña:  Conversiones
Ventana de audiencia: 30 días (si la landing tiene <500 visitas/mes, amplía a 60)
Frecuencia máx.:      3–4 impresiones por semana por usuario
Budget optimization:  Ad Set Budget (fijo, 50 €/mes)
```

---

## Señales de alerta — cuándo pausar un ad set

| Señal | Acción |
|-------|--------|
| CPM > 20 € por 7 días | Revisa segmentación, reduce especificidad |
| CTR < 0.8% en Feed | Cambia creatividad |
| CPA > 80 € por 2 semanas | Pausa el ad set, analiza el embudo |
| Frecuencia > 3.5 en 7 días | Rota creatividades o amplía audiencia |
| 0 conversiones con > 100 € gastados | Verifica el Pixel — puede ser error técnico |

---

## Fases de bidding por madurez de la cuenta

| Conversiones en cuenta | Estrategia recomendada |
|----------------------|----------------------|
| 0–15/mes | Lowest Cost (sin restricciones) — deja aprender a Meta |
| 15–30/mes | Cost Cap en 55 € (10% por encima del target CPA) |
| 30+/mes | Cost Cap en 45 € o prueba Bid Cap |

> No toques la estrategia de puja ni la segmentación durante la fase de aprendizaje
> (primeras 50 conversiones o 7 días desde el lanzamiento).
