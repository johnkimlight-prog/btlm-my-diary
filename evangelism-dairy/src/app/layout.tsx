import type { Metadata } from "next";
import "./globals.css";
import { ConfigProvider, App as AntdApp } from "antd"; // 💡 App 추가 임포트// 💡 방금 만든 보안 래퍼 임포트
import SecurityWrapper from '@/components/SecurityWrapper';

export const metadata: Metadata = {
  title: "나의 전도 다이어리",
  description: "바돌로매지파 전도 다이어리 시스템",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#13c2c2",
              fontSize: 16,
              colorText: "#262626",
            },
          }}
        >
          {/* 💡 AntdApp으로 전체를 감싸주어 테마와 Message/Modal 컨텍스트를 동기화합니다 */}
          <AntdApp>
            
            {/* 🛡️ 캡처 방지 및 고유번호 워터마크 적용 */}
            <SecurityWrapper>
              {children}
            </SecurityWrapper>
            
          </AntdApp>
        </ConfigProvider>
      </body>
    </html>
  );
}