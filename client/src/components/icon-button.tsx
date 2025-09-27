import React from 'react';
import { FontAwesomeIcon, FontAwesomeIconProps } from '@fortawesome/react-fontawesome';

export const IconButton: React.FC<{
  onClick?: () => void;
  icon: FontAwesomeIconProps["icon"];
  title: string;
  variant?: 'default' | 'danger' | 'primary' | 'success';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = ({ onClick, icon, title, variant = 'default', onMouseEnter, onMouseLeave }) => {
  const variantClasses = {
    default: 'text-gray-600 hover:text-gray-800 hover:bg-gray-200',
    danger: 'text-red-600 hover:text-red-800 hover:bg-red-200',
    primary: 'text-blue-600 hover:text-blue-800 hover:bg-blue-200',
    success: 'text-green-600 hover:text-green-800 hover:bg-green-200'
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`px-1 py-0.5 rounded transition-colors ${variantClasses[variant]}`}
      title={title}
    >
      <FontAwesomeIcon icon={icon} size="sm" />
    </button>
  );
};
