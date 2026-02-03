import React from 'react';
import {AbsoluteFill} from 'remotion';
import {palette} from '../styles';

export const Background: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.bg,
        backgroundImage:
          'radial-gradient(1200px 700px at 10% 10%, rgba(91, 124, 250, 0.12), transparent 60%), radial-gradient(900px 600px at 90% 20%, rgba(255, 255, 255, 0.06), transparent 55%)',
      }}
    />
  );
};
