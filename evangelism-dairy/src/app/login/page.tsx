"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, Form, Input, Button, message, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";

const { Title } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // 고유번호 자동 하이픈 포맷팅 함수 (00000000-00000)
  const handleMemberNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, ""); // 숫자만 추출
    if (value.length > 8) {
      value = value.slice(0, 8) + "-" + value.slice(8, 13);
    }
    form.setFieldsValue({ member_no: value });
  };

  const onFinish = async (values: { member_no: string; password: string }) => {
    setLoading(true);
    
    // 고유번호를 이메일 형식으로 변환하여 Supabase에 요청
    const email = `${values.member_no}@ydp.com`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: values.password,
    });

    if (error) {
      message.error("고유번호 또는 비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    // 초기 비밀번호(000000)인 경우 강제 변경 페이지로 이동
    if (values.password === "000000") {
      message.warning("최초 로그인입니다. 비밀번호를 변경해 주세요.");
      router.push("/update-password");
    } else {
      message.success("로그인에 성공했습니다.");
      router.push("/");
    }
    
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f0f2f5" }}>
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>나의 전도 다이어리</Title>
          <p style={{ color: "#8c8c8c", marginTop: 8 }}>고유번호로 로그인해 주세요</p>
        </div>

        <Form form={form} name="login" onFinish={onFinish} layout="vertical">
          <Form.Item
            name="member_no"
            rules={[
              { required: true, message: "고유번호를 입력해 주세요." },
              { len: 14, message: "올바른 고유번호 형식이 아닙니다. (예: 12345678-12345)" }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="고유번호 (00000000-00000)" 
              size="large" 
              onChange={handleMemberNoChange}
              maxLength={14}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "비밀번호를 입력해 주세요." }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="비밀번호" 
              size="large" 
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              로그인
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}