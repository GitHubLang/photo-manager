import React from 'react';
import { Typography, Divider } from 'antd';
const { Text } = Typography;

/**
 * ThemeSwitcher — 主题切换组件（占位）
 * 后续可扩展为色彩主题选择器
 */
export default function ThemeSwitcher() {
  return (
    <div style={{ maxWidth: 500 }}>
      <Text>主题切换功能</Text>
      <Divider />
      <Text type="secondary">
        当前使用浅色主题。深色模式等更多主题选项将在后续版本支持。
      </Text>
    </div>
  );
}
