import React from "react";

export default function Logo({ size = 160, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        {/* Outer Circular Border */}
        <circle
          cx="100"
          cy="100"
          r="92"
          stroke="var(--accent)"
          strokeWidth="4"
          fill="var(--bg-primary)"
        />
        
        {/* Inner Accent Ring */}
        <circle
          cx="100"
          cy="100"
          r="84"
          stroke="var(--text-primary)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          fill="none"
        />

        {/* Crossed Fork & Spoon Icon at the Top Center */}
        <g transform="translate(100, 68) scale(0.95)">
          {/* Spoon (Diagonal from bottom-left to top-right) */}
          <g transform="rotate(45)">
            {/* Handle */}
            <path
              d="M 0,15 L 0,-15"
              stroke="var(--text-primary)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Head */}
            <path
              d="M -7,-15 C -7,-24 7,-24 7,-15 C 7,-9 -7,-9 -7,-15 Z"
              fill="var(--text-primary)"
              stroke="var(--text-primary)"
              strokeWidth="1"
            />
          </g>

          {/* Fork (Diagonal from bottom-right to top-left) */}
          <g transform="rotate(-45)">
            {/* Handle */}
            <path
              d="M 0,15 L 0,-12"
              stroke="var(--text-primary)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Base of fork head */}
            <path
              d="M -5.5,-12 L 5.5,-12 L 4.5,-20 L -4.5,-20 Z"
              fill="var(--text-primary)"
            />
            {/* Prongs */}
            <path
              d="M -4.5,-20 L -4.5,-27 M -1.5,-20 L -1.5,-27 M 1.5,-20 L 1.5,-27 M 4.5,-20 L 4.5,-27"
              stroke="var(--text-primary)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
          
          {/* Center joint ribbon/accent */}
          <circle cx="0" cy="5" r="4.5" fill="var(--accent)" stroke="var(--text-primary)" strokeWidth="1.5" />
        </g>

        {/* Brand Initials 'PFC' in the Center */}
        <text
          x="100"
          y="122"
          fill="var(--text-primary)"
          fontSize="30"
          fontWeight="800"
          fontFamily="'Outfit', sans-serif"
          letterSpacing="1.5"
          textAnchor="middle"
        >
          PFC
        </text>

        {/* Hidden Path for Bottom Arc Text */}
        {/* Starts at 230 degrees, ends at 310 degrees approximately */}
        <path
          id="pfc-text-path"
          d="M 33 118 A 69 69 0 0 0 167 118"
          fill="none"
          stroke="none"
        />

        {/* Curved Brand Text around Bottom Arc */}
        <text fill="var(--text-primary)" fontSize="11" fontWeight="700" letterSpacing="2.8" fontFamily="'Outfit', sans-serif">
          <textPath href="#pfc-text-path" startOffset="50%" textAnchor="middle">
            PARADISE FOOD CORNER
          </textPath>
        </text>
      </svg>
    </div>
  );
}
