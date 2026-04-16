import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';

// Route segment config
export const runtime = 'nodejs';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Image generation
export default async function Icon() {
  const headersList = await headers();
  const host = (headersList.get('host') || '').toLowerCase();
  
  // Detect brand and set config
  let config = {
    text: 'MZ',
    bg: '#2563eb', // Moda Zapo Blue
    fontSize: 16
  };

  if (host.includes('kalexa')) {
    config = {
      text: 'Kf',
      bg: '#8124E3', // Kalexa Purple
      fontSize: 18
    };
  } else if (host.includes('zonadelvestir')) {
    config = {
      text: 'ZdV',
      bg: '#BE123C', // ZDV Red (Muted/Deep red)
      fontSize: 14
    };
  }

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: config.fontSize,
          background: config.bg,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
        }}
      >
        {config.text}
      </div>
    ),
    { ...size }
  );
}
