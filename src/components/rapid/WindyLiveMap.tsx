import { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, CloudRain, Crosshair, Minus, Plus, RefreshCw, Thermometer, Wind } from 'lucide-react';
import './windy-live.css';

type Overlay = 'wind' | 'rain' | 'temp' | 'clouds';
type Status = 'loading' | 'ready' | 'error';
const overlays = [
  { value: 'wind', label: 'Wind', icon: Wind },
  { value: 'rain', label: 'Rain', icon: CloudRain },
  { value: 'temp', label: 'Temperature', icon: Thermometer },
  { value: 'clouds', label: 'Clouds', icon: Cloud },
] as const;
const errors: Record<string, string> = {
  script: 'Windy could not be downloaded. Check the connection and try again.',
  authorization: 'Windy did not accept this Map Forecast key or this website. Check that the key is a Map Forecast key, its allowed domains, and its plan. Point Forecast keys cannot open this map.',
  timeout: 'Windy weather data did not finish loading. Check the connection, Map Forecast key, and allowed website domains, then retry.',
  initialize: 'Windy could not start. Check the Map Forecast key and website authorization, then retry.',
};

// The Maps key is supplied at runtime. Escape HTML-significant characters before
// putting configuration into the trusted iframe script; never interpolate raw text.
function scriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function frameDocument(apiKey: string, lat: number, lng: number, reducedMotion: boolean, token: string) {
  const config = scriptJson({ key: apiKey, lat, lon: lng, particles: !reducedMotion, token, origin: window.location.origin });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Windy weather forecast map</title><style>html,body,#windy{margin:0;width:100%;height:100%;overflow:hidden;background:#152635}body{font-family:Arial,sans-serif}</style></head><body><div id="windy"></div><script>
  (function () {
    'use strict';
    var config = ${config};
    var api = null;
    var timer;
    function send(type, values) {
      window.parent.postMessage(Object.assign({channel:'rapid-windy',token:config.token,type:type}, values || {}), config.origin);
    }
    function fail(code) { clearTimeout(timer); send('error', {code:code}); }
    function classify(error) {
      var message = String(error && (error.message || error) || '');
      return /key|unauthori|forbidden|domain|license|licence|401|403/i.test(message) ? 'authorization' : 'initialize';
    }
    function publish(type) {
      if (!api) return;
      var timestamp = api.store.get('timestamp');
      var allowed = api.store.getAllowed('overlay');
      send(type, {
        timestamp: typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null,
        overlay: api.store.get('overlay'),
        product: String(api.store.get('product') || ''),
        particles: api.store.get('particlesAnim') === 'on',
        allowed: Array.isArray(allowed) ? allowed.filter(function (value) { return ['wind','rain','temp','clouds'].indexOf(value) >= 0; }) : null
      });
    }
    function load(src) {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = src; script.onload = resolve; script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    window.addEventListener('unhandledrejection', function (event) { fail(classify(event.reason)); });
    window.addEventListener('error', function (event) { if (event.message) fail(classify(event.error || event.message)); });
    window.addEventListener('message', function (event) {
      if (event.source !== window.parent || event.origin !== config.origin || !api) return;
      var message = event.data;
      if (!message || message.channel !== 'rapid-windy-command' || message.token !== config.token) return;
      try {
        if (message.action === 'overlay' && ['wind','rain','temp','clouds'].indexOf(message.value) >= 0) {
          var allowed = api.store.getAllowed('overlay');
          if (Array.isArray(allowed) && allowed.indexOf(message.value) < 0) { send('unavailable'); return; }
          api.store.set('overlay', message.value);
        } else if (message.action === 'particles' && typeof message.value === 'boolean') {
          api.store.set('particlesAnim', message.value ? 'on' : 'off');
          publish('state');
        } else if (message.action === 'zoom' && (message.value === 1 || message.value === -1)) {
          if (message.value === 1) api.map.zoomIn(); else api.map.zoomOut();
        } else if (message.action === 'center' && Number.isFinite(message.lat) && Number.isFinite(message.lng) && Math.abs(message.lat) <= 85 && Math.abs(message.lng) <= 180) {
          api.map.setView([message.lat, message.lng], api.map.getZoom(), {animate: !message.reducedMotion});
        }
      } catch (_) { send('unavailable'); }
    });
    timer = setTimeout(function () { fail('timeout'); }, 45000);
    load('https://unpkg.com/leaflet@1.4.0/dist/leaflet.js').then(function () {
      return load('https://api.windy.com/assets/map-forecast/libBoot.js');
    }).then(function () {
      if (typeof window.windyInit !== 'function') { fail('initialize'); return; }
      try {
        var pending = window.windyInit({key:config.key,lat:config.lat,lon:config.lon,zoom:5,overlay:'wind',level:'surface',particlesAnim:config.particles ? 'on' : 'off',timestamp:Date.now(),verbose:false}, function (windy) {
          api = windy;
          api.store.on('timestamp', function () { publish('state'); });
          api.store.on('overlay', function () { publish('state'); });
          api.store.on('product', function () { publish('state'); });
          api.store.on('particlesAnim', function () { publish('state'); });
          api.broadcast.on('redrawFinished', function () { clearTimeout(timer); publish('rendered'); });
          publish('ready');
        });
        if (pending && typeof pending.catch === 'function') pending.catch(function (error) { fail(classify(error)); });
      } catch (error) { fail(classify(error)); }
    }).catch(function () { fail('script'); });
  })();
  </script></body></html>`;
}

export function WindyLiveMap({ lat, lng, apiKey, reducedMotion = false }: {
  lat: number; lng: number; apiKey: string; reducedMotion?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef({ lat, lng, reducedMotion });
  current.current = { lat, lng, reducedMotion };
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [overlay, setOverlay] = useState<Overlay>('wind');
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [product, setProduct] = useState('');
  const [particles, setParticles] = useState(!reducedMotion);
  const [rendered, setRendered] = useState(false);
  const [notice, setNotice] = useState('');
  const document = useMemo(() => {
    const token = crypto.randomUUID();
    const center = current.current;
    return { token, html: frameDocument(apiKey, center.lat, center.lng, center.reducedMotion, token) };
  }, [apiKey, attempt]);

  function command(action: string, values: Record<string, unknown> = {}) {
    frame.current?.contentWindow?.postMessage({ channel: 'rapid-windy-command', token: document.token, action, ...values }, window.location.origin);
  }

  useEffect(() => {
    setStatus('loading'); setError(''); setTimestamp(null); setRendered(false); setNotice(''); setAllowed(null);
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.channel !== 'rapid-windy' || message.token !== document.token) return;
      if (message.type === 'error') {
        setError(errors[message.code] ?? errors.initialize); setStatus('error'); return;
      }
      if (message.type === 'unavailable') { setNotice('This layer or setting is unavailable for the current Windy model or plan.'); return; }
      if (!['ready', 'state', 'rendered'].includes(message.type)) return;
      if (message.type === 'ready' || message.type === 'rendered') setStatus('ready');
      if (message.type === 'rendered') setRendered(true);
      if (message.type === 'state') setRendered(false);
      if (typeof message.timestamp === 'number' && Number.isFinite(message.timestamp)) setTimestamp(message.timestamp);
      if (overlays.some(item => item.value === message.overlay)) setOverlay(message.overlay);
      if (typeof message.product === 'string') setProduct(message.product.slice(0, 40));
      if (typeof message.particles === 'boolean') setParticles(message.particles);
      if (Array.isArray(message.allowed)) setAllowed(message.allowed.filter((value: unknown) => typeof value === 'string'));
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [document]);

  useEffect(() => {
    if (status !== 'ready') return;
    frame.current?.contentWindow?.postMessage({ channel: 'rapid-windy-command', token: document.token, action: 'center', lat, lng, reducedMotion }, window.location.origin);
  }, [lat, lng, status, document.token, reducedMotion]);
  useEffect(() => {
    if (status !== 'ready') return;
    frame.current?.contentWindow?.postMessage({ channel: 'rapid-windy-command', token: document.token, action: 'particles', value: !reducedMotion }, window.location.origin);
  }, [reducedMotion, status, document.token]);

  return <section className="rapid-windy" aria-label="Windy weather forecast map">
    <div className="rapid-windy-toolbar">
      <div className="rapid-windy-layers" role="group" aria-label="Weather layer">
        {overlays.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={overlay === value} disabled={!apiKey || status !== 'ready' || (allowed !== null && !allowed.includes(value))} onClick={() => { setNotice(''); command('overlay', { value }); }}><Icon size={16} />{label}</button>)}
      </div>
      <label className="rapid-windy-particles"><input type="checkbox" checked={particles} disabled={!apiKey || status !== 'ready'} onChange={event => command('particles', { value: event.target.checked })} />Wind animation</label>
    </div>
    <div className="rapid-windy-meta" aria-live="polite">
      <span><strong>Weather model forecast</strong>{product && ` · ${product.toUpperCase()}`}</span>
      <span>{timestamp ? `Valid ${new Date(timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}` : 'Forecast time pending'}</span>
      <span>{rendered ? 'Forecast layer loaded' : status === 'error' ? 'Provider unavailable' : 'Loading weather field…'}</span>
    </div>
    <div className="rapid-windy-map">
      {apiKey && <iframe key={document.token} ref={frame} title="Windy interactive weather forecast" srcDoc={document.html} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="strict-origin-when-cross-origin" />}
      {(!apiKey || status === 'error' || status === 'loading') && <div className="rapid-windy-status" role="status">
        <Wind size={28} />
        <strong>{!apiKey ? 'Windy Map Forecast key needed' : status === 'error' ? 'Windy map unavailable' : 'Opening Windy weather map'}</strong>
        <p>{!apiKey ? 'Configure a Windy Map Forecast key on the RAPID backend to display the weather map.' : status === 'error' ? error : 'Loading the forecast layers and wind animation.'}</p>
        {apiKey && status === 'error' && <button type="button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={15} />Retry Windy</button>}
      </div>}
    </div>
    <div className="rapid-windy-footer">
      <span>{notice || 'Use the Windy timeline to choose a forecast time. Click the map to inspect local weather.'}</span>
      <div role="group" aria-label="Weather map navigation"><button type="button" disabled={status !== 'ready'} aria-label="Zoom in weather map" onClick={() => command('zoom', { value: 1 })}><Plus size={17} /></button><button type="button" disabled={status !== 'ready'} aria-label="Zoom out weather map" onClick={() => command('zoom', { value: -1 })}><Minus size={17} /></button><button type="button" disabled={status !== 'ready'} aria-label="Recenter weather map on selected region" onClick={() => command('center', { lat, lng, reducedMotion })}><Crosshair size={17} /></button></div>
    </div>
  </section>;
}
