export const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

export const setCookie = (name: string, value: string, days = 30) => {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Lax`;
};

export const UTM_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'fbp',
  'fbc',
  'campaign_id',
  'adset_id',
  'ad_id',
  'campaign_name',
  'adset_name',
  'ad_name'
];

export const captureUtms = () => {
  if (typeof window === 'undefined') return;
  
  const urlParams = new URLSearchParams(window.location.search);
  const utmData: Record<string, string> = {};

  UTM_PARAMS.forEach(param => {
    const value = urlParams.get(param);
    if (value) {
      utmData[param] = value;
      // Save to localStorage
      localStorage.setItem(`utm_${param}`, value);
      // Save to cookie
      setCookie(`utm_${param}`, value);
    }
  });

  // Also capture fbp/fbc from cookies if they exist (Meta often sets these)
  const fbp = getCookie('_fbp');
  const fbc = getCookie('_fbc');
  if (fbp) {
    localStorage.setItem('utm_fbp', fbp);
    setCookie('utm_fbp', fbp);
  }
  if (fbc) {
    localStorage.setItem('utm_fbc', fbc);
    setCookie('utm_fbc', fbc);
  }

  return utmData;
};

export const getStoredUtms = () => {
  const utmData: Record<string, string> = {};
  UTM_PARAMS.forEach(param => {
    const value = localStorage.getItem(`utm_${param}`) || getCookie(`utm_${param}`);
    if (value) {
      utmData[param] = value;
    }
  });
  return utmData;
};

export const appendUtmsToUrl = (url: string) => {
  try {
    const utms = getStoredUtms();
    if (Object.keys(utms).length === 0) return url;

    const urlObj = new URL(url, window.location.origin);
    Object.entries(utms).forEach(([key, value]) => {
      if (!urlObj.searchParams.has(key)) {
        urlObj.searchParams.set(key, value);
      }
    });
    return urlObj.toString();
  } catch (e) {
    console.error('Error appending UTMs to URL:', e);
    return url;
  }
};
