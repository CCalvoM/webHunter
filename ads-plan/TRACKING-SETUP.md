# WebHunter CRM — Configuración de Tracking
**No lances ningún anuncio sin completar este checklist.**

---

## Plataformas a configurar (Fase 1)

| Plataforma | Cliente (navegador) | Servidor | Prioridad |
|-----------|-------------------|----------|-----------|
| Meta Pixel | ✅ Obligatorio | Recomendado (CAPI) | P1 |
| Google Analytics 4 | ✅ Recomendado | — | P1 |
| Google Ads Tag | Solo si añades Google Ads en Fase 2 | Enhanced Conv. | P2 |

---

## Meta Pixel — Instalación paso a paso

### 1. Crear el Pixel

1. Ve a [Meta Business Manager](https://business.facebook.com) → Events Manager
2. Haz clic en **"Añadir origen de datos"** → **Pixel**
3. Nómbralo: `WebHunter Pixel`
4. Copia el Pixel ID (formato: `123456789012345`)

### 2. Instalar el código base en tu landing page

Pega este bloque en el `<head>` de tu landing page HTML (antes del `</head>`):

```html
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'TU_PIXEL_ID_AQUÍ');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=TU_PIXEL_ID_AQUÍ&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->
```

### 3. Configurar los eventos de conversión

Estos son los eventos que necesitas disparar. Edita el JavaScript de tu landing:

```html
<!-- Evento: usuario completa el registro / suscripción -->
<script>
// Llama a esta función cuando el usuario se suscriba con éxito
function trackSubscription(price) {
  fbq('track', 'Subscribe', {
    value: price,
    currency: 'EUR',
    predicted_ltv: price * 4
  });
}

// Evento: usuario hace clic en el botón de CTA principal (sin completar aún)
document.getElementById('cta-button').addEventListener('click', function() {
  fbq('track', 'InitiateCheckout');
});

// Evento: usuario llega a la página de confirmación/gracias
// (pon esto en la página de "¡Gracias por suscribirte!")
fbq('track', 'Purchase', {
  value: 29,  // precio real del plan
  currency: 'EUR'
});
</script>
```

> Si tu landing no tiene página de "gracias" separada, usa el evento `Lead` cuando
> el formulario se envíe exitosamente, o `CompleteRegistration` para registros.

### 4. Verificar que funciona

1. Instala la extensión de Chrome **[Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper)**
2. Visita tu landing page — el icono debe ponerse verde y mostrar `PageView`
3. Haz clic en el botón CTA — debe aparecer `InitiateCheckout`
4. Completa un registro de prueba — debe aparecer `Subscribe` o `Purchase`

---

## Configurar el evento de conversión en Meta Ads

1. Ve a Events Manager → tu Pixel → **"Configurar"**
2. En **Prioridad de eventos**, sube `Subscribe` (o `Purchase`) al primer lugar
3. Al crear la campaña, selecciona este evento como objetivo de conversión

---

## Google Analytics 4 — Instalación básica (recomendado)

Aunque no estés usando Google Ads ahora, GA4 te da datos de comportamiento en la landing.

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Crea una propiedad GA4 en [analytics.google.com](https://analytics.google.com) y sustituye `G-XXXXXXXXXX` por tu Measurement ID.

---

## UTM Parameters — estructura estándar

Etiqueta todos los anuncios con UTMs para distinguir el tráfico de pago en GA4:

```
https://tu-landing.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=prospecting&utm_content=video_demo_v1
```

| Parámetro | Valor para campañas Meta |
|-----------|------------------------|
| utm_source | `meta` |
| utm_medium | `paid_social` |
| utm_campaign | Nombre de la campaña (ej. `prospecting_freelancers`) |
| utm_content | Nombre del creativo (ej. `video_demo_v1`, `carousel_pain`) |

---

## Checklist pre-lanzamiento

- [ ] Pixel ID copiado e instalado en el `<head>` de la landing
- [ ] Evento `PageView` verificado con Pixel Helper
- [ ] Evento de conversión principal (`Subscribe` / `Purchase`) disparando correctamente
- [ ] Evento `InitiateCheckout` en el botón CTA
- [ ] GA4 instalado y datos fluyendo en tiempo real
- [ ] UTM parameters añadidos a la URL de destino del anuncio
- [ ] Landing revisada en móvil (iOS y Android)
- [ ] Velocidad de la landing < 3s ([PageSpeed Insights](https://pagespeed.web.dev/))
- [ ] Dominio verificado en Meta Business Manager

---

## CAPI (Conversions API) — Fase 2

Cuando tengas presupuesto técnico, implementa CAPI para mejorar la señal a Meta
(especialmente importante con iOS 14.5+ que bloquea cookies).

Para una SPA estática la opción más simple es el **Meta Gateway (sin código)**:
→ Business Manager → Events Manager → tu Pixel → Configuración → Gateway CAPI

Esto requiere que tu landing esté en un subdominio controlado por ti.
