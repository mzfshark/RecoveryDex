import React, { useState } from 'react';
import styles from '../styles/Global.module.css';
import { useContract } from '../context/ContractContext';

const TokenSelector = ({ label, selectedToken, onSelect }) => {
  const { tokenList = [] } = useContract();
  const [open, setOpen] = useState(false);

  const handleSelect = (token) => {
    onSelect(token);
    setOpen(false);
  };

  return (
    <div className={`${styles.tokenSelector} relative`}>
      {label && <label className={styles['tokenText']}>{label}</label>}

      {/* Button to open dropdown */}
      <button
        type="button"
        className={`${styles.tokenSelector} button flex itemscenter gap-2`}
        onClick={() => setOpen(!open)}
      >
        {selectedToken ? (
          <>
            {selectedToken.logoURI && (
              <img
                src={selectedToken.logoURI}
                alt={selectedToken.symbol}
                style={{ width: '24px', height: '24px', borderRadius: '50%' }}
              />
            )}
            <span>{selectedToken.symbol}</span>
          </>
        ) : (
          <span>Select Token</span>
        )}
      </button>

      {/* Dropdown menu */}
      {open && (
        <ul className={styles.dropdownToggle}>
          {tokenList.map((token) => (
            <li
              key={token.address}
              className={styles.selectorLiItem}
              onClick={() => handleSelect(token)}
            >
              {token.logoURI && (
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  style={{ width: '22px', height: '22px', borderRadius: '50%' }}
                />
              )}
              <span>{token.symbol}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TokenSelector;
