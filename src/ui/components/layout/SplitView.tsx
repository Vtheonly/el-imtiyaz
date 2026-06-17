/**
 * SplitView — list/detail layout. Used for master-detail screens.
 */

import { ReactNode } from 'react';

interface SplitViewProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: string;
}

export function SplitView({ left, right, leftWidth = '35%' }: SplitViewProps) {
  return (
    <div className="el-split-view">
      <div className="el-split-view__left" style={{ flex: `0 0 ${leftWidth}` }}>
        {left}
      </div>
      <div className="el-split-view__right">
        {right}
      </div>
    </div>
  );
}
