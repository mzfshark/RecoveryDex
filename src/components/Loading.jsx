// src/components/Loading.jsx
import React from 'react';
import styles from '../styles/Global.module.css';

const Loading = ({ message = 'Loading...', size = 'medium' }) => {
  const sizeClass = size === 'small' ? 'spinnerSmall' : size === 'large' ? 'spinnerLarge' : '';
  
  return (
    <div className={`${styles.center} ${styles.mtMD}`}>
      <div className={`${styles.spinner} ${sizeClass}`}></div>
      {message && (
        <p className={`${styles.mutedText} ${styles.mtSM} ${styles.centerText}`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default Loading;
