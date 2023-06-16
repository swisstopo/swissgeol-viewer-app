const GA_MEASUREMENT_ID = 'G-E15CQLC985';

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
  }
}
