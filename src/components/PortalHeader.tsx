import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PortalHeaderProps {
    children: React.ReactNode;
}

const PortalHeader: React.FC<PortalHeaderProps> = ({ children }) => {
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setContainer(document.getElementById('topbar-left'));
    }, []);

    if (!container) return null;

    return createPortal(
        <div className="flex items-center justify-between w-full h-full pr-4">
            {children}
        </div>,
        container
    );
};

export default PortalHeader;
