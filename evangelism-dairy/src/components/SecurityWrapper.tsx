"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";

export default function SecurityWrapper({ children }: { children: React.ReactNode }) {
  const [memberNo, setMemberNo] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // 1. 현재 로그인한 사용자의 고유번호 가져오기
    const fetchMemberNo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("members").select("member_no").eq("id", user.id).single();
        if (data) setMemberNo(data.member_no);
      }
    };
    fetchMemberNo();

    // 2. 우클릭, 드래그, 복사 방지 이벤트 (로그인 페이지 제외)
    if (pathname !== "/login") {
      const preventDefault = (e: Event) => e.preventDefault();
      
      document.addEventListener("contextmenu", preventDefault); // 우클릭 방지
      document.addEventListener("selectstart", preventDefault); // 드래그 방지
      document.addEventListener("copy", preventDefault);        // 복사(Ctrl+C) 방지

      return () => {
        document.removeEventListener("contextmenu", preventDefault);
        document.removeEventListener("selectstart", preventDefault);
        document.removeEventListener("copy", preventDefault);
      };
    }
  }, [pathname]);

  // 로그인 페이지는 워터마크와 보안 정책을 적용하지 않음
  if (pathname === "/login") return <>{children}</>;

  // 💡 사선 워터마크 SVG 생성 (고유번호를 투명하게 사선으로 반복)
  const svgWatermark = memberNo ? `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
      <text x="50%" y="50%" transform="rotate(-35 110 110)" text-anchor="middle" font-size="28" fill="rgba(0, 0, 0, 0.08)" font-weight="bold" font-family="sans-serif">
        ${memberNo}
      </text>
    </svg>
  ` : '';

  const encodedWatermark = typeof window !== "undefined" && memberNo 
    ? `url(data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svgWatermark)))})` 
    : 'none';

  return (
    <>
      {/* 인쇄(Ctrl+P) 시 화면 숨김 CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print { body { display: none !important; } }
        body { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }
      `}} />
      
      {/* 콘텐츠 */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>

      {/* 💡 화면 전체를 덮는 투명 사선 워터마크 */}
      {memberNo && (
        <div 
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: encodedWatermark,
            backgroundRepeat: "repeat",
            pointerEvents: "none", // 마우스 클릭이 뚫고 지나가게 함 (매우 중요)
            zIndex: 9999, // 화면 최상단에 배치
          }} 
        />
      )}
    </>
  );
}