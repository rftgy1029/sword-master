import { useId } from 'react';

function BronzeCrest({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-metal`} x1="16%" y1="8%" x2="84%" y2="92%">
          <stop offset="0%" stopColor="#f3caa0" />
          <stop offset="48%" stopColor="#c88652" />
          <stop offset="100%" stopColor="#774422" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#35221c" />
          <stop offset="100%" stopColor="#1b1110" />
        </linearGradient>
      </defs>
      {/* Sturdy heater shield */}
      <path
        d="M32 10 51 16.5 49 38.5C48 50.5 41 59.2 32 64.5 23 59.2 16 50.5 15 38.5L13 16.5Z"
        fill={`url(#${id}-metal)`}
        stroke="#3b2011"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Top rim bevel highlight */}
      <path
        d="M15.5 17.8 32 12.2 48.5 17.8"
        fill="none"
        stroke="#fae0c2"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.78"
      />
      {/* Inner shield field */}
      <path
        d="M32 15.8 45.6 20.4 44.1 37.8C43.3 46.8 38.2 53.6 32 57.8 25.8 53.6 20.7 46.8 19.9 37.8L18.4 20.4Z"
        fill={`url(#${id}-field)`}
        stroke="#8d562f"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Corner rivets */}
      <circle cx="22" cy="22.5" r="1.4" fill="#e5b382" />
      <circle cx="42" cy="22.5" r="1.4" fill="#e5b382" />
      {/* Subtle chevron accent */}
      <path
        d="M23.5 34.5 32 41 40.5 34.5"
        fill="none"
        stroke="#b67645"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.65"
      />
      {/* Forged bronze short-sword */}
      <path d="M32 20.5 35.3 26.5 34.3 41.5H32Z" fill="#b4713e" />
      <path d="M32 20.5 28.7 26.5 29.7 41.5H32Z" fill="#f7dab9" />
      <path d="M25.2 41.5H38.8L37.5 44.6H26.5Z" fill={`url(#${id}-metal)`} stroke="#3b2011" strokeWidth="1" strokeLinejoin="round" />
      <path d="M30.4 44.6H33.6V49.6L32 52.4 30.4 49.6Z" fill="#d99d6a" stroke="#3b2011" strokeWidth="0.9" strokeLinejoin="round" />
    </>
  );
}

function SilverCrest({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-metal`} x1="12%" y1="6%" x2="88%" y2="94%">
          <stop offset="0%" stopColor="#f5fbff" />
          <stop offset="46%" stopColor="#b8cbd6" />
          <stop offset="100%" stopColor="#5c7080" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#263442" />
          <stop offset="100%" stopColor="#121923" />
        </linearGradient>
      </defs>
      {/* Protruding crossed twin sword hilts behind shield */}
      <g stroke="#1b2631" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        <path d="M11 10.5 20.5 20M53 10.5 43.5 20" stroke={`url(#${id}-metal)`} strokeWidth="3.2" />
        <path d="M10.5 16.2 16.5 10.2M53.5 16.2 47.5 10.2" stroke="#dce9f0" strokeWidth="2.4" />
        <circle cx="10.2" cy="9.8" r="2.6" fill="#e6f2f8" />
        <circle cx="53.8" cy="9.8" r="2.6" fill="#e6f2f8" />
      </g>
      {/* Flared knight kite shield */}
      <path
        d="M32 8.5 53 16.5 49.8 40.5C48.6 51.5 41.2 60.2 32 66 22.8 60.2 15.4 51.5 14.2 40.5L11 16.5Z"
        fill={`url(#${id}-metal)`}
        stroke="#1b2631"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Inner steel field */}
      <path
        d="M32 14.2 47.2 20 44.6 39.6C43.6 48.2 38.2 54.8 32 59.2 25.8 54.8 20.4 48.2 19.4 39.6L16.8 20Z"
        fill={`url(#${id}-field)`}
        stroke="#7b92a3"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Heraldic vertical half sheen */}
      <path
        d="M32 14.2 47.2 20 44.6 39.6C43.6 48.2 38.2 54.8 32 59.2Z"
        fill="#ffffff"
        opacity="0.06"
      />
      {/* Crossed blades inside field */}
      <path d="M22.5 24 41.5 45.5M41.5 24 22.5 45.5" stroke="#9eb6c7" strokeWidth="2.4" strokeLinecap="round" opacity="0.82" />
      {/* Faceted silver diamond boss */}
      <path d="M32 23.5 40.5 34.5 32 45.5 23.5 34.5Z" fill="#dceaf2" stroke="#1b2631" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M32 23.5 32 34.5 23.5 34.5Z" fill="#ffffff" />
      <path d="M32 34.5 40.5 34.5 32 45.5Z" fill="#7c93a6" />
      <path d="M32 27.8 36.2 34.5 32 41.2 27.8 34.5Z" fill="#324658" />
      <path d="M32 30.5 34.3 34.5 32 38.5 29.7 34.5Z" fill="#e8f6ff" />
    </>
  );
}

function GoldCrest({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-metal`} x1="14%" y1="6%" x2="86%" y2="94%">
          <stop offset="0%" stopColor="#fff6c4" />
          <stop offset="45%" stopColor="#e8ba4d" />
          <stop offset="100%" stopColor="#946218" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#422132" />
          <stop offset="100%" stopColor="#1b0e18" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="46%" r="48%">
          <stop offset="0%" stopColor="#ffe588" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffe588" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Royal 3-point coronet */}
      <path
        d="M19.5 17 21.5 7.5 27.6 12.2 32 4 36.4 12.2 42.5 7.5 44.5 17Z"
        fill={`url(#${id}-metal)`}
        stroke="#3b2508"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="13.2" r="1.8" fill="#ff745c" stroke="#532018" strokeWidth="0.8" />
      {/* Scalloped royal shield with flared shoulders */}
      <path
        d="M32 14.5 44 16.5 55 19.5 51.5 26 50.2 41C49 52 41.5 60.5 32 66.5 22.5 60.5 15 52 13.8 41L12.5 26 9 19.5 20 16.5Z"
        fill={`url(#${id}-metal)`}
        stroke="#3b2508"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Deep royal plum-burgundy field */}
      <path
        d="M32 19.5 47.4 23 45.2 40.4C44.2 49 38.4 55.6 32 60.2 25.6 55.6 19.8 49 18.8 40.4L16.6 23Z"
        fill={`url(#${id}-field)`}
        stroke="#c99535"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="36" r="13" fill={`url(#${id}-glow)`} />
      {/* Subtle lower laurel arcs */}
      <path
        d="M21.5 41.5C22.4 47.8 26.2 52.5 31 55.2M42.5 41.5C41.6 47.8 37.8 52.5 33 55.2"
        fill="none"
        stroke="#d8a541"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.72"
      />
      {/* Radiant 4-point sun-star + champion sword */}
      <path
        d="M32 21.5 35.2 31.8 44.5 35 35.2 38.2 32 54 28.8 38.2 19.5 35 28.8 31.8Z"
        fill={`url(#${id}-metal)`}
        stroke="#3b2508"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M32 23.5 34 32.8 32 35 30 32.8Z" fill="#fff9db" />
      <circle cx="32" cy="35" r="2.7" fill="#fff3bd" stroke="#8f5c14" strokeWidth="1" />
    </>
  );
}

function PlatinumCrest({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-metal`} x1="12%" y1="6%" x2="88%" y2="94%">
          <stop offset="0%" stopColor="#ecfffc" />
          <stop offset="46%" stopColor="#7ed6cb" />
          <stop offset="100%" stopColor="#2e7374" />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8fffb" />
          <stop offset="55%" stopColor="#77cfc5" />
          <stop offset="100%" stopColor="#357d7d" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#16353a" />
          <stop offset="100%" stopColor="#0b1a1f" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9efaf0" stopOpacity="0.52" />
          <stop offset="100%" stopColor="#9efaf0" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Sweeping left & right crystalline wings */}
      <g fill={`url(#${id}-wing)`} stroke="#102b2e" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M18 22.5 3.5 14 8.2 26.8 17 30.2Z" />
        <path d="M17.2 31.2 5.8 29 10.2 39.2 18.2 40.2Z" />
        <path d="M19 41.2 11.4 42.6 16.4 50.8 22 48.2Z" />
        <path d="M46 22.5 60.5 14 55.8 26.8 47 30.2Z" />
        <path d="M46.8 31.2 58.2 29 53.8 39.2 45.8 40.2Z" />
        <path d="M45 41.2 52.6 42.6 47.6 50.8 42 48.2Z" />
      </g>
      {/* Faceted diamond-spire shield */}
      <path
        d="M32 5 49.5 19.5 46.2 44.5 32 66.5 17.8 44.5 14.5 19.5Z"
        fill={`url(#${id}-metal)`}
        stroke="#102b2e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Top crystal bevel highlight */}
      <path d="M32 7.8 46.5 20.2 32 15.8 17.5 20.2Z" fill="#eafffc" opacity="0.65" />
      {/* Inner faceted field */}
      <path
        d="M32 13.5 44.2 22.8 41.6 42.6 32 58.8 22.4 42.6 19.8 22.8Z"
        fill={`url(#${id}-field)`}
        stroke="#6ac4ba"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="35" r="12.5" fill={`url(#${id}-glow)`} />
      {/* Filigree diamond halo */}
      <path d="M32 18.5 41.2 35 32 51.5 22.8 35Z" fill="none" stroke="#8ee8de" strokeWidth="1.1" opacity="0.6" />
      {/* Glowing faceted aquamarine prism core */}
      <path d="M32 21.5 40.2 35 32 49.5 23.8 35Z" fill="#5bd3c6" stroke="#102b2e" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M32 21.5 32 35 23.8 35Z" fill="#eafffd" />
      <path d="M32 21.5 40.2 35 32 35Z" fill="#98f4e9" />
      <path d="M32 35 40.2 35 32 49.5Z" fill="#237574" />
      <path d="M32 27.5 35.4 35 32 42.5 28.6 35Z" fill="#ffffff" opacity="0.55" />
    </>
  );
}

function MasterCrest({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-amethyst`} x1="10%" y1="6%" x2="90%" y2="94%">
          <stop offset="0%" stopColor="#f7e6ff" />
          <stop offset="46%" stopColor="#c48ae8" />
          <stop offset="100%" stopColor="#5e2e8c" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#fff4be" />
          <stop offset="48%" stopColor="#e8b648" />
          <stop offset="100%" stopColor="#8f5c14" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#2c1544" />
          <stop offset="100%" stopColor="#12081e" />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f0a8ff" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#a952e8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Grand seraphic outer wings */}
      <g fill={`url(#${id}-amethyst)`} stroke="#220f35" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M18.5 21 2.2 10.5 6.8 25 16.5 29.2Z" />
        <path d="M17.2 29.8 3.8 26.8 8.8 38.2 17.8 39.8Z" />
        <path d="M18.8 40.5 9.5 41.8 15.2 51.2 21.8 48.2Z" />
        <path d="M45.5 21 61.8 10.5 57.2 25 47.5 29.2Z" />
        <path d="M46.8 29.8 60.2 26.8 55.2 38.2 46.2 39.8Z" />
        <path d="M45.2 40.5 54.5 41.8 48.8 51.2 42.2 48.2Z" />
      </g>
      {/* Sovereign gold upper wing trim */}
      <path
        d="M5.2 13.8 16.8 22.8M58.8 13.8 47.2 22.8"
        stroke={`url(#${id}-gold)`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* 5-point imperial sovereign crown */}
      <path
        d="M17.5 16.5 18.8 7.8 24.4 12.2 27.6 5.2 32 10.8 36.4 5.2 39.6 12.2 45.2 7.8 46.5 16.5Z"
        fill={`url(#${id}-gold)`}
        stroke="#2f1c06"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="4.2" r="2.1" fill="#f5d9ff" stroke="#4a216f" strokeWidth="1" />
      {/* Imperial shield frame (gold outer, amethyst inner bevel) */}
      <path
        d="M32 14.5 48.5 21 45.6 44.5C44.4 53.5 38.5 61 32 67.2 25.5 61 19.6 53.5 18.4 44.5L15.5 21Z"
        fill={`url(#${id}-gold)`}
        stroke="#2a1608"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      {/* Cosmic violet inner field */}
      <path
        d="M32 18.8 44.6 24 42.2 43.4C41.2 50.6 36.8 56.6 32 61.5 27.2 56.6 22.8 50.6 21.8 43.4L19.4 24Z"
        fill={`url(#${id}-field)`}
        stroke="#c98ef0"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="36.5" r="13.5" fill={`url(#${id}-core)`} />
      {/* Radiant 4-point star behind sword */}
      <path
        d="M32 23.5 34.8 33.6 43.5 36.5 34.8 39.4 32 49.5 29.2 39.4 20.5 36.5 29.2 33.6Z"
        fill="#e7b6ff"
        opacity="0.48"
      />
      {/* Iconic Master Sword piercing vertically */}
      <path d="M32 19.5 34.8 25.5 33.8 47.5H32Z" fill="#c389e8" />
      <path d="M32 19.5 29.2 25.5 30.2 47.5H32Z" fill="#fff7ff" />
      {/* Golden winged crossguard */}
      <path
        d="M22.2 44.8 28.5 47.2H35.5L41.8 44.8 38.2 50H25.8Z"
        fill={`url(#${id}-gold)`}
        stroke="#2f1c06"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* Pommel */}
      <path d="M30.5 50H33.5V55.2L32 58.2 30.5 55.2Z" fill={`url(#${id}-gold)`} stroke="#2f1c06" strokeWidth="0.9" strokeLinejoin="round" />
      {/* Luminous amethyst rune crystal at heart */}
      <path d="M32 30.2 37.2 36.5 32 42.8 26.8 36.5Z" fill="#e59eff" stroke="#2c1045" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 30.2 32 36.5 26.8 36.5Z" fill="#ffffff" opacity="0.88" />
    </>
  );
}

function PersonalCrest({ id }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-gold`} x1="14%" y1="10%" x2="86%" y2="90%">
          <stop offset="0%" stopColor="#fbe6ba" />
          <stop offset="50%" stopColor="#d69f54" />
          <stop offset="100%" stopColor="#7f5422" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#32233c" />
          <stop offset="100%" stopColor="#191122" />
        </linearGradient>
      </defs>
      {/* Octagonal grimoire seal */}
      <path
        d="M21 10H43L54 21V47L43 60H21L10 47V21Z"
        fill={`url(#${id}-gold)`}
        stroke="#362110"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M23 14.5H41L49.5 23V45L41 55.5H23L14.5 45V23Z"
        fill={`url(#${id}-field)`}
        stroke="#9b703a"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Glowing star spark above book */}
      <path d="M32 17.5 33.8 22.2 38.5 24 33.8 25.8 32 30.5 30.2 25.8 25.5 24 30.2 22.2Z" fill="#ffe6a3" />
      {/* Open spellbook */}
      <path
        d="M19.5 32.5C24.5 31 29 32 32 35 35 32 39.5 31 44.5 32.5V47.5C39.5 46 35 47 32 49.5 29 47 24.5 46 19.5 47.5Z"
        fill="#f7eed8"
        stroke="#4f3319"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M32 35V49.5" stroke="#8f6737" strokeWidth="1.5" />
      {/* Bookmark ribbon */}
      <path d="M36 46.8V54L38.2 52 40.4 54V46.6Z" fill="#e06f56" stroke="#471d16" strokeWidth="0.9" strokeLinejoin="round" />
    </>
  );
}

const CRESTS = {
  bronze: BronzeCrest,
  silver: SilverCrest,
  gold: GoldCrest,
  platinum: PlatinumCrest,
  master: MasterCrest,
  personal: PersonalCrest,
};

export default function TierCrest({ tier = 'bronze', small = false }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const Crest = CRESTS[tier] ?? BronzeCrest;
  return (
    <svg
      className={`tier-crest tier-${tier}${small ? ' is-small' : ''}`}
      viewBox="0 0 64 72"
      shapeRendering="geometricPrecision"
      aria-hidden="true"
    >
      <Crest id={`tc-${uid}`} />
    </svg>
  );
}
