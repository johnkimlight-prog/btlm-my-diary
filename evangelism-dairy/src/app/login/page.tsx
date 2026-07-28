"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, Form, Input, Button, Checkbox, Typography, ConfigProvider, App } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const MINT_COLOR = "#13c2c2";

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // 💡 1. 로컬스토리지에서 저장된 고유번호 불러오기
  useEffect(() => {
    const savedMemberNo = localStorage.getItem("remember_member_no");
    if (savedMemberNo) {
      form.setFieldsValue({ member_no: savedMemberNo, remember: true });
    }
  }, [form]);

  // 💡 2. 고유번호 자동 포맷팅 (숫자만 허용, 8자리 뒤 하이픈 자동 삽입)
  const handleMemberNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, ""); // 숫자가 아닌 문자 제거
    if (value.length > 8) {
      value = value.substring(0, 8) + "-" + value.substring(8, 13);
    }
    form.setFieldsValue({ member_no: value });
  };

  const handleLogin = async (values: any) => {
    setLoading(true);
    // 고유번호를 이메일 형식으로 변환하여 로그인 시도
    const email = `${values.member_no}@ydp.com`;
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: values.password,
    });

    if (error) {
      message.error("고유번호 또는 비밀번호를 확인해주세요.");
      setLoading(false);
      return;
    }

    // 💡 3. 로그인 성공 시, 체크 여부에 따라 고유번호를 브라우저에 저장
    if (values.remember) {
      localStorage.setItem("remember_member_no", values.member_no);
    } else {
      localStorage.removeItem("remember_member_no");
    }

    message.success("로그인되었습니다.");
    router.push("/");
  };

  return (
    <ConfigProvider theme={{ token: { colorPrimary: MINT_COLOR } }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: 20 }}>
        <Card style={{ width: '100%', maxWidth: 400, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <Title level={3} style={{ color: MINT_COLOR, margin: 0 }}>나의 전도 다이어리 📖</Title>
            <Text type="secondary">바돌로매지파 전도 시스템</Text>
          </div>

          <Form form={form} layout="vertical" onFinish={handleLogin} size="large">
            <Form.Item name="member_no" rules={[{ required: true, message: '고유번호를 입력해주세요.' }]}>
              <Input 
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} 
                placeholder="고유번호 (예: 00360000-00000)" 
                onChange={handleMemberNoChange} // 💡 포맷팅 함수 연결
                maxLength={14} // 💡 하이픈 포함 최대 14자리까지만 입력 가능하도록 제한
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: '비밀번호를 입력해주세요.' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="비밀번호" />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 16 }}>
              <Checkbox>나의 고유번호 기억하기</Checkbox>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 45, borderRadius: 8, fontSize: '1.1rem' }}>
                로그인
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </ConfigProvider>
  );
}