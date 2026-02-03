import React from 'react';
import {palette, fonts} from '../styles';

type CtaProps = {
  text: string;
  fontSize: number;
};

export const Cta: React.FC<CtaProps> = ({text, fontSize}) => {
  return (
    <div
      style={{
        fontFamily: fonts.body,
        fontSize,
        fontWeight: 600,
        color: palette.textStrong,
        padding: '12px 18px',
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: 'rgba(32, 37, 44, 0.65)',
        letterSpacing: 0.4,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
      }}
    >
      {text}
    </div>
  );
};
