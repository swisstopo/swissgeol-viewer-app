const GA_MEASUREMENT_ID = 'G-E15CQLC985';

export function initAnalytics(active) {
  if (active) {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.insertBefore(script, document.head.firstChild);

    // @ts-ignore
    window.dataLayer = window.dataLayer || [];

    sendAnalytics('js', new Date());
    sendAnalytics('config', GA_MEASUREMENT_ID, {
      anonymize_ip: true,
    });
    sendAnalytics('event', 'page_view');
  }
}

export function sendAnalytics(_command, ..._args) {
  // @ts-ignore
  if (window.dataLayer) {
    // @ts-ignore
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  }
}
