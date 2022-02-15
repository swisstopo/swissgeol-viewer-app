const GA_MEASUREMENT_ID = 'UA-139508900-9';

export function initAnalytics(active) {

  window[`ga-disable-${GA_MEASUREMENT_ID}`] = !active;

  if (active) {
    /* eslint-disable */
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
    })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

    ga('create', GA_MEASUREMENT_ID, 'auto');
    ga('set', 'anonymizeIp', true);

    ga('send', 'pageview');

    /* Hotjar Tracking Code for www.swissgeol.ch */
    (function (h, o, t, j, a, r) {
      h.hj = h.hj || function () {(h.hj.q = h.hj.q || []).push(arguments)};
      h._hjSettings = {hjid: 2463857, hjsv: 6};
      a = o.getElementsByTagName('head')[0];
      r = o.createElement('script'); r.async = 1;
      r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
      a.appendChild(r);
    })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=')
  }
}
