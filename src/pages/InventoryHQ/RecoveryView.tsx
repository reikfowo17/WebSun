import React from 'react';
import { User } from '../../types';

interface RecoveryViewProps {
    toast: any;
}

const RecoveryView: React.FC<RecoveryViewProps> = ({ toast }) => {
    return (
        <div className="p-10 text-center text-gray-500">
            Tính năng Xử Lý Chênh Lệch đang được cập nhật...
        </div>
    );
};

export default RecoveryView;
