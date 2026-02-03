import React from 'react';
import {Img, staticFile} from 'remotion';

type LogoProps = {
  size: number;
  opacity?: number;
};

export const Logo: React.FC<LogoProps> = ({size, opacity = 1}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        overflow: 'hidden',
        opacity,
        boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
      }}
    >
      <Img src={staticFile('assets/logo.png')} style={{width: '100%', height: '100%'}} />
    </div>
  );
};
