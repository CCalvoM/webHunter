# Cloza — Ficha Técnica del Proyecto

> CRM web para freelancers que venden webs a negocios locales sin presencia digital.
> Fecha de actualización: 2026-05-21 (rev 2)

---

## 1. Visión general

**Cloza** ayuda a freelancers a encontrar negocios locales sin web (o con web deficiente), auditar su situación digital con IA y enviar un pitch de venta personalizado en cuestión de minutos.

**Flujo principal:**
1. Buscar negocios por ciudad + sector → Google Places API
2. Detectar estado web (sin web / web falsa / rota / pobre / correcta)
3. Generar audit con IA (Claude Sonnet) → score + issues + pitch de ventas
4. Gestionar leads en pipeline Kanban
5. Enviar pitch por email (Gmail), WhatsApp o llamada

---

## 2. Arquitectura general

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend — React 18 + Vite 8 + TypeScript 6                 │
│  app.cloza.es  (Vercel, branch: main)                        │
└───────────────────────┬──────────────────────────────────────┘
                        │ REST + Auth JWT
┌───────────────────────▼──────────────────────────────────────┐
│  Supabase (BaaS)                                             │
│  ├─ PostgreSQL (DB)                                          │
│  ├─ Auth (email/password + Google OAuth)                     │
│  ├─ RLS policies (aislamiento por user_id)                   │
│  └─ Edge Functions (Deno)                                    │
│       ├─ places-search   → Google Places (New) API           │
│       ├─ generate-audit  → Anthropic API (Claude Sonnet 4.6) │
│       └─ check-web       → HTTP check + PageSpeed Insights   │
└──────────────────────────────────────────────────────────────┘
```

**Dominio adicional:**
- `cloza.es` — landing page (branch: `landing`, proyecto Vercel separado: `web-hunter`)

---

## 3. Stack completo

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.3.1 | UI |
| TypeScript | ~6.0.2 | Tipado estático |
| Vite | 8.x | Bundler + dev server |
| React Router DOM | 7.15.1 | Routing SPA |
| Tailwind CSS | 3.4.19 | Estilos |
| `@hello-pangea/dnd` | 18.0.1 | Drag & drop (Kanban) |
| `@supabase/supabase-js` | 2.105.4 | Cliente DB + Auth |
| `@supabase/auth-ui-react` | 0.4.7 | UI de login |
| lucide-react | 1.16.0 | Iconos |
| clsx | 2.1.1 | Clases condicionales |
| `@sentry/react` | 10.53.1 | Error tracking |

### Backend (Edge Functions — Deno)
| Función | Runtime | APIs externas |
|---|---|---|
| `places-search` | Deno 1.x | Google Places (New) API v1 |
| `generate-audit` | Deno 1.x | Anthropic API (claude-sonnet-4-6) |
| `check-web` | Deno 1.x | PageSpeed Insights API v5 |

### Infraestructura
| Servicio | Uso |
|---|---|
| Supabase (free tier) | DB, Auth, Edge Functions, Storage |
| Vercel | Hosting frontend (2 proyectos) |
| Sentry | Error tracking + source maps |
| Umami | Analytics de privacidad (cloud.umami.is) |
| Google Cloud | Places API, PageSpeed API, OAuth |

---

## 4. Base de datos (PostgreSQL / Supabase)

### Tablas

#### `prospects`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | Auto-generado |
| `user_id` | uuid FK → auth.users | RLS: usuario solo ve los suyos |
| `place_id` | text | ID de Google Places (unique por user) |
| `name` | text | Nombre del negocio |
| `address` | text | Dirección completa |
| `city` | text | Ciudad (normalizada con capitalize) |
| `phone` | text? | Teléfono (raw de Google) |
| `website` | text? | URL de web si tiene |
| `google_maps_url` | text? | URL de Google Maps |
| `rating` | numeric? | Valoración Google (0-5) |
| `review_count` | int? | Número de reseñas |
| `category` | text | Sector buscado |
| `web_status` | enum | `no_web / fake_web / broken_web / poor_web / has_web` |
| `audit_score` | int? | Score 0-100 (IA o estimado) |
| `audit_summary` | text? | Issues separados por ` \| ` |
| `audit_pitch` | text? | Pitch de ventas generado por Claude |
| `pagespeed_score` | int? | Rendimiento móvil PageSpeed (0-100) |
| `pagespeed_seo` | int? | SEO score PageSpeed (0-100) |
| `stage` | enum | `encontrado / contactado / respondio / demo / cerrado / descartado` |
| `notes` | text? | Notas libres del usuario |
| `followup_date` | date? | Fecha de seguimiento |
| `created_at` / `updated_at` | timestamptz | |

#### `activities`
Historial de acciones por prospecto.
| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `prospect_id` | uuid FK → prospects |
| `user_id` | uuid FK |
| `type` | enum: `created / stage_changed / email_sent / note_added / followup_set / audit_generated / data_flagged` |
| `content` | text? |
| `created_at` | timestamptz |

#### `pipeline_events`
Registro de cada movimiento de etapa (para analítica de funnel futura).
| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `prospect_id` | uuid FK |
| `user_id` | uuid FK |
| `from_stage` | enum? |
| `to_stage` | enum |
| `created_at` | timestamptz |

#### `templates`
Plantillas de outreach personalizadas por usuario.
| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `name` | text |
| `sector` | text |
| `subject` | text |
| `body` | text (soporta `[nombre]`, `[ciudad]`, `[sector]`) |
| `created_at` | timestamptz |

#### `credits`
Control de uso y límites por usuario.
| Campo | Tipo | Free | Pro |
|---|---|---|---|
| `user_id` | uuid PK | | |
| `plan` | enum: `free / pro` | | |
| `searches_used` | int | 0 | 0 |
| `searches_limit` | int | 10 | 100 |
| `audits_used` | int | 0 | 0 |
| `audits_limit` | int | 5 | 50 |
| `reset_date` | date? | null (vitalicio) | mensual |

#### `feedback`
Feedback en-app de usuarios.
| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid? FK |
| `type` | enum: `bug / sugerencia / otro` |
| `message` | text |
| `page` | text (pathname) |
| `created_at` | timestamptz |

#### `data_flags`
Reportes de datos incorrectos de leads (dirección, teléfono, etc.).
| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `prospect_id` | uuid FK |
| `user_id` | uuid FK |
| `flag_type` | enum: `wrong_address / wrong_phone / wrong_website / business_closed / already_has_web / other` |
| `notes` | text? |
| `created_at` | timestamptz |

#### `rate_limits`
Anti-abuso para `check-web`: máx. 20 llamadas/hora por usuario.
| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `fn` | text (nombre de la función) |
| `created_at` | timestamptz |

---

## 5. Módulos del frontend

### Routing (`src/App.tsx`)
```
/login               → Login (pública)
/app                 → ProtectedRoute > AppLayout
  /app               → Dashboard (index)
  /app/discovery     → Búsqueda de negocios
  /app/pipeline      → Kanban
  /app/prospect/:id  → Detalle de prospecto
  /app/settings      → Ajustes
/                    → Redirect → /app
*                    → Redirect → /app
```

### Páginas

| Página | Ruta | Descripción |
|---|---|---|
| **Login** | `/login` | Email/password + Google OAuth. Redirige a `/app` tras auth. Permite reenviar confirmación. |
| **Dashboard** | `/app` | Stats (total, contactados, demos, cerrados), funnel de conversión por etapa, tabla de últimos 5 leads. |
| **Discovery** | `/app/discovery` | Formulario ciudad + sector → llama a `places-search`. Muestra resultados con score estimado, filtros de estado web, añadir al pipeline. |
| **Pipeline** | `/app/pipeline` | Kanban drag & drop (desktop) / tabs + lista (móvil). 5 columnas: Encontrado, Contactado, Respondió, Demo, Cerrado. |
| **Prospect** | `/app/prospect/:id` | Detalle completo: datos de contacto, selector de etapa, audit IA, outreach (copiar/Gmail/WhatsApp/llamar), notas, fecha seguimiento, historial, flag de datos, eliminar. |
| **Settings** | `/app/settings` | Nombre de usuario, plan y créditos (barras de progreso), gestión de plantillas (CRUD). |

### Componentes

| Componente | Descripción |
|---|---|
| `AppLayout` | Sidebar con nav, logo, info de usuario y logout. Renderiza `Outlet` + modal de onboarding + botón de feedback. |
| `OnboardingModal` | 3 pasos: nombre → cómo funciona → CTA primera búsqueda. Controlado por `localStorage` (`cloza_onboarded`). |
| `FeedbackButton` | Botón flotante bottom-right. Modal con selector de tipo + textarea. Guarda en tabla `feedback`. |
| `ProtectedRoute` | Comprueba sesión activa; redirige a `/login` si no hay sesión. |
| `ToastContext` | Sistema de notificaciones toast (éxito/info/error). |

### Hooks

| Hook | Responsabilidad |
|---|---|
| `useAuth` | Session, user, signOut. |
| `useProspects` | CRUD de prospects, load (límite 500 filas), updateStage, saveAudit, addProspect (con check-web async en background). |
| `useCredits` | Carga créditos, expone `canSearch` y `canAudit`. |
| `useActivities` | Log y carga de actividades por prospect. |
| `useTemplates` | CRUD de plantillas. |
| `useDataFlags` | Envío de flags de datos incorrectos. |
| `usePipelineEvents` | Registro de eventos de movimiento en pipeline. |

### Librerías internas (`src/lib/`)

| Archivo | Funciones |
|---|---|
| `places.ts` | `searchPlaces()` (llama Edge Function), `detectWebStatus()` (síncrono, por URL), `calculateAuditScore()` (heurístico), `getAuditIssues()` (sin IA), mock de resultados en dev. |
| `audit.ts` | `generateAudit()` — llama Edge Function `generate-audit`, con cache si ya tiene pitch guardado. |
| `supabase.ts` | Singleton del cliente Supabase. |

---

## 6. Edge Functions (Supabase / Deno)

### `places-search`
- **Auth:** Bearer JWT → valida con `supabase.auth.getUser()`
- **Créditos:** Verifica server-side `searches_used < searches_limit` antes de llamar a Google
- **API:** Google Places (New) `places:searchText`, `languageCode: 'es'`, `regionCode: 'ES'`, máx. 20 resultados
- **Campos devueltos:** id, displayName, formattedAddress, nationalPhoneNumber, websiteUri, rating, userRatingCount, types, googleMapsUri
- **Consumo:** Incrementa `searches_used` solo si la búsqueda fue exitosa

### `generate-audit`
- **Auth:** Bearer JWT
- **Créditos:** Verifica `audits_used < audits_limit` antes de llamar a Claude
- **Sanitización:** Inputs limpiados contra prompt injection (`sanitize()`)
- **Modelo:** `claude-sonnet-4-6`, `max_tokens: 1200`
- **Prompt:** Genera un JSON con `score`, `web_status`, `issues[]`, `lost_clients_estimate`, `pitch`
  - Score calibrado por `web_status` + penalización PageSpeed
  - Issues específicos, locales y cuantificables por ciudad/sector
  - Pitch siguiendo principios de Dale Carnegie (reconocimiento → oportunidad → pregunta de control)
  - Firma obligatoria: `[nombre]` en línea propia al final
  - Estadísticas sectoriales específicas (restaurantes, fontaneros, peluquerías, etc.)
- **Consumo:** Incrementa `audits_used` tras respuesta OK

### `check-web`
- **Auth:** Bearer JWT
- **Rate limiting:** Máx. 20 llamadas/hora por usuario (tabla `rate_limits`)
- **Limpieza de `rate_limits`:** En cada request se borra el historial antiguo del usuario activo. Con probabilidad 1%, se lanza una limpieza global de toda la tabla (evita crecimiento indefinido con múltiples usuarios).
- **SSRF protection:** Bloquea localhost, IPs privadas (10.x, 192.168.x, 172.16-31.x, 169.254.x, IPv6 privadas)
- **Flujo:**
  1. HTTP GET con timeout de 9s → si falla → `broken_web`
  2. PageSpeed Insights API (mobile) → `performance` + `seo` score
  3. Clasifica: perf < 20 → `broken_web`, perf < 50 o SEO < 40 → `poor_web`, resto → `has_web`
- **Se llama en background** al añadir un prospect con `web_status = 'has_web'`

---

## 7. Lógica de negocio clave

### Detección de estado web (síncrona, frontend)
| Condición | Estado |
|---|---|
| Sin campo `website` | `no_web` |
| URL contiene facebook/instagram/twitter/tiktok/linktree/wa.me/linkedin | `fake_web` |
| URL contiene wix/weebly/jimdo/webnode/blogspot/wordpress.com/sites.google.com/godaddysites | `poor_web` |
| Cualquier otro dominio propio | `has_web` (luego `check-web` puede refinarlo) |

### Score heurístico (estimado en Discovery)
- Base por web_status: sin web = 0, rota = 5, falsa = 10, pobre = 25, tiene web = 50
- Rating Google: ≥4.5 = +20, ≥4.0 = +15, ≥3.0 = +10, resto = +5
- Reseñas: ≥100 = +20, ≥50 = +15, ≥20 = +10, resto = +5
- Tiene teléfono: +10

### Score IA (generate-audit)
Calibrado por web_status con techo máximo:
- `no_web` → max 35
- `fake_web` → max 50
- `broken_web` → max 45 (−penalización PageSpeed)
- `poor_web` → max 60 (−penalización PageSpeed)
- `has_web` → 55-80 (±PageSpeed/SEO)

### Detección de teléfono (para outreach)
- Normalización: elimina espacios, guiones, paréntesis, `+34`, `0034`
- Móvil: empieza por 6 o 7 y tiene exactamente 9 dígitos → WhatsApp
- Fijo: empieza por 8 o 9 → botón de llamada
- WhatsApp URL: `https://wa.me/34{number}?text={pitch_encoded}`

### Resolución de `[nombre]` en el pitch
- Al mostrar o copiar el pitch, `resolvePitch()` sustituye `[nombre]` por `user.user_metadata.display_name`
- Si el usuario no tiene nombre configurado, muestra aviso con link a Ajustes

---

## 8. Autenticación

- **Proveedor:** Supabase Auth
- **Métodos:** Email/password + Google OAuth 2.0
- **Post-login:** `onAuthStateChange` en Login.tsx detecta la sesión y navega a `/app`
- **Confirmación email:** Redirige a `https://app.cloza.es` (configurado en Supabase Site URL)
- **Onboarding:** Primer acceso detectado por `localStorage('cloza_onboarded')` → muestra modal de 3 pasos
- **Google OAuth:** Configurado en Google Cloud Console. En modo test, solo funciona para usuarios añadidos manualmente a la lista de testers.

---

## 9. Seguridad

| Capa | Medida |
|---|---|
| **RLS (Supabase)** | Todas las tablas filtran por `user_id = auth.uid()` |
| **Edge Functions** | Validan JWT en cada request; créditos verificados server-side |
| **Prompt injection** | `sanitize()` en `generate-audit`: elimina `<>{}[]`, limita longitud |
| **SSRF** | `isSafeUrl()` en `check-web` bloquea IPs privadas y localhost |
| **Rate limiting** | `check-web`: 20 req/hora por usuario (tabla `rate_limits`) |
| **CSP (Vercel)** | `default-src 'self'`; allowlist explícita para Supabase, Sentry, Umami, Google Fonts, PageSpeed |
| **HSTS** | `max-age=31536000; includeSubDomains; preload` |
| **Otros headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` |

---

## 10. Despliegue

### App (`app.cloza.es`)
- **Proyecto Vercel:** `appcloza`
- **Branch:** `main`
- **Build:** `tsc -b && vite build`
- **SPA routing:** `vercel.json` rewrite `/(.*) → /index.html`
- **Variables de entorno Vercel (configuradas):**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SENTRY_DSN`
  - `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`
  - `VITE_UMAMI_WEBSITE_ID`

### Landing (`cloza.es`)
- **Proyecto Vercel:** `web-hunter`
- **Branch:** `landing`
- **Contenido:** Estático (HTML/CSS/JS vanilla)
- **`.gitignore`:** añadido en branch `landing` (ignora `node_modules`, `dist`, `.env*`)

### Edge Functions
Despliegue manual con Supabase CLI:
```bash
supabase functions deploy places-search
supabase functions deploy generate-audit
supabase functions deploy check-web
```
Secrets (no en `.env`):
```bash
supabase secrets set GOOGLE_PLACES_KEY=...
supabase secrets set ANTHROPIC_API_KEY=...
```

---

## 11. Variables de entorno

### Frontend (`.env.local`)
| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública |
| `VITE_SENTRY_DSN` | DSN de Sentry |
| `SENTRY_AUTH_TOKEN` | Token para upload de source maps |
| `SENTRY_ORG` | Slug de organización Sentry |
| `SENTRY_PROJECT` | Slug de proyecto Sentry |
| `VITE_UMAMI_WEBSITE_ID` | ID de sitio Umami |
| `VITE_UMAMI_SCRIPT_URL` | (vacío = cloud.umami.is) |

### Edge Functions (Supabase Secrets)
| Secret | Uso |
|---|---|
| `GOOGLE_PLACES_KEY` | Places API + PageSpeed Insights |
| `ANTHROPIC_API_KEY` | Claude API |
| `SUPABASE_URL` | Auto-inyectado |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectado |
| `ALLOWED_ORIGIN` | CORS (opcional, default `*`) |

---

## 12. Observabilidad

| Herramienta | Qué mide |
|---|---|
| **Sentry** | Errores JS en frontend (con source maps en prod). Configurado en `src/main.tsx`. |
| **Umami** | Visitas, pageviews, eventos de usuario. Script inyectado en `index.html`. |
| **Supabase Logs** | Logs de Edge Functions (accesibles en dashboard Supabase). |

---

## 13. Patrones de diseño

- **Custom hooks** como capa de datos: `useProspects`, `useCredits`, etc. — separan lógica de UI
- **Optimistic updates**: estado local se actualiza antes de la respuesta de Supabase
- **Background async**: `check-web` se lanza fire-and-forget al añadir un prospect; no bloquea UX
- **Cache de audit**: `generateAudit()` devuelve datos guardados si ya existen, sin llamar a Claude
- **Placeholder resolution en runtime**: `[nombre]` se resuelve al copiar/mostrar, nunca en DB
- **Responsive by breakpoint**: Pipeline es Kanban en desktop y tabs+lista en móvil
- **SPA con rewrites Vercel**: toda ruta desconocida → `index.html`, React Router gestiona el resto

---

## 14. Pendientes y deuda técnica

### Funcionalidad pendiente confirmada
- [ ] Separar proyectos Sentry y Umami para app vs landing (actualmente comparten instancia)
- [x] ~~Configurar proyecto Vercel dedicado para `main` con todas las env vars~~ → hecho (`appcloza`)
- [ ] Añadir email de beta tester como Google OAuth test user (mientras la app esté en modo test en Google Cloud)
- [ ] Sección "Próximamente" en Settings lista: integración Google Calendar y exportar CSV

### Deuda técnica / mejoras detectadas
- [x] ~~`zustand`, `@tanstack/react-query`, `axios` instalados pero no usados~~ → eliminados de `package.json`
- [x] ~~Tabla `rate_limits` crece indefinidamente~~ → `check-web` ahora hace limpieza global con probabilidad 1% por request
- [x] ~~Sin límite en `loadProspects`~~ → añadido `.limit(500)`
- [ ] Sin tests automatizados (unit ni e2e)
- [ ] Sin paginación real en `loadProspects` (límite actual: 500 filas)

### Ideas roadmap (mencionadas en sesiones anteriores)
- Integración Google Calendar para seguimientos
- Exportar leads a CSV
- Facturación y gestión de plan (upgrade a Pro)
- Outreach por LinkedIn (contacto sin email/teléfono)
- Integración Facebook Messenger
- Separar instancias Sentry/Umami por entorno

---

## 15. Estructura de archivos

```
webHunter/
├── index.html                      # Entry point HTML, favicon SVG inline
├── vercel.json                     # SPA rewrites + security headers
├── package.json
├── tailwind.config.js
├── vite.config.ts
├── src/
│   ├── main.tsx                    # Bootstrap, Sentry init, Umami script
│   ├── App.tsx                     # Router principal
│   ├── types/
│   │   └── index.ts                # Todos los tipos/interfaces
│   ├── lib/
│   │   ├── supabase.ts             # Cliente Supabase singleton
│   │   ├── places.ts               # searchPlaces, detectWebStatus, calculateAuditScore
│   │   └── audit.ts                # generateAudit (con cache)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProspects.ts
│   │   ├── useCredits.ts
│   │   ├── useActivities.ts
│   │   ├── useTemplates.ts
│   │   ├── useDataFlags.ts
│   │   └── usePipelineEvents.ts
│   ├── contexts/
│   │   └── ToastContext.tsx
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── OnboardingModal.tsx
│   │   └── FeedbackButton.tsx
│   └── pages/
│       ├── Login.tsx
│       ├── AppLayout.tsx
│       ├── Dashboard.tsx
│       ├── Discovery.tsx
│       ├── Pipeline.tsx
│       ├── Prospect.tsx
│       └── Settings.tsx
└── supabase/
    └── functions/
        ├── places-search/index.ts
        ├── generate-audit/index.ts
        └── check-web/index.ts
```
