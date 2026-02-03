import React from 'react';
import {palette, fonts} from '../styles';

type HeadlineProps = {
  text: string;
  align?: 'left' | 'center';
  maxWidth: number;
  fontSize: number;
};

export const Headline: React.FC<HeadlineProps> = ({
  text,
  align = 'left',
  maxWidth,
  fontSize,
}) => {
  return (
    <div
      style={{
        fontFamily: fonts.headline,
        fontSize,
        fontWeight: 650,
        lineHeight: 1.15,
        color: palette.textStrong,
        maxWidth,
        textAlign: align,
        letterSpacing: 0.2,
      }}
    >
      {text}
    </div>
  );
};
