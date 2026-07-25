"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Card, Button, Typography, Row, Col, Badge, Modal, Form, 
  Input, Select, DatePicker, TimePicker, Tabs, Calendar, message, Spin, Statistic, Popconfirm, ConfigProvider 
} from "antd";
import { 
  UserOutlined, TrophyOutlined, EditOutlined, 
  PlusOutlined, CheckCircleFilled, CloseCircleOutlined, BarChartOutlined 
} from "@ant-design/icons";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from "recharts";
import dayjs from "dayjs";
import 'dayjs/locale/ko';
import weekOfYear from "dayjs/plugin/weekOfYear";

dayjs.extend(weekOfYear);
dayjs.locale('ko');

const { Title, Text } = Typography;
const { TextArea } = Input;

const ACTIVITY_TOOLS = ["노방", "지인", "온라인", "기타"];
const CHURCH_LIST = ["영등포", "부천", "화곡", "김포", "광명"]; // 실제 교회명으로 수정하세요.
// 1. 파일 상단(import 아래)에 부서별 지역 매핑 데이터를 선언합니다.

const REGION_MAP: Record<string, string[]> = {
  "자문": [],
  "장년": ["보라매", "목동", "홍대", "영등포", "숭실대"],
  "부녀": ["보라매", "목동", "홍대", "영등포", "숭실", "노량진", "서울대"],
  "청년": ["보라매", "목동", "홍대", "영등포", "숭실", "노량진", "대학부", "새신자", "문래", "여의도", "국제", "새신자부"],
  "교역": ["교회", "센터", "중진"]
  // 실제 교회의 부서와 지역 리스트로 수정해 주세요.
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [profileForm] = Form.useForm();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      router.push("/login");
      return;
    }

    const { data: memberData } = await supabase
      .from("members")
      .select("*")
      .eq("id", user.id)
      .single();

    if (memberData) {
      setMember(memberData);
      fetchActivityLogs(user.id);
    } else {
      message.error("등록된 성도 프로필 정보가 없습니다.");
      setLoading(false);
    }
  };

  const fetchActivityLogs = async (memberId: string) => {
    const { data: logData } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("member_id", memberId)
      .order("activity_date", { ascending: false });

    if (logData) {
      setLogs(logData);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 활동 시간(시간 단위 Float) 계산 헬퍼 함수
  const getDurationHours = (start: string, end: string) => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins < 0) diffMins += 24 * 60;
    return Number((diffMins / 60).toFixed(1));
  };

  const handleReportSubmit = async (values: any) => {
    const dateStr = values.activity_date.format("YYYY-MM-DD");
    const newStart = values.time_range[0].format("HH:mm");
    const newEnd = values.time_range[1].format("HH:mm");

    const isOverlapping = logs.some(log => {
      if (log.activity_date !== dateStr) return false;
      const existingStart = log.start_time.slice(0, 5);
      const existingEnd = log.end_time.slice(0, 5);
      return (newStart < existingEnd) && (newEnd > existingStart);
    });

    if (isOverlapping) {
      message.error("해당 날짜와 겹치는 활동 시간이 이미 보고되어 있습니다.");
      return;
    }

    const { error } = await supabase
      .from("activity_logs")
      .insert([{
        member_id: member.id,
        activity_date: dateStr,
        start_time: newStart,
        end_time: newEnd,
        tool_used: values.tool_used,
        find_1_count: values.find_1_count || 0,
        find_2_count: values.find_2_count || 0,
        description: values.description
      }]);

    if (error) {
      message.error("활동 보고에 실패했습니다.");
    } else {
      message.success("활동이 성공적으로 보고되었습니다!");
      setIsReportModalOpen(false);
      form.resetFields();
      fetchActivityLogs(member.id);
    }
  };

  const getWeeklyData = () => {
    const today = dayjs();
    const dayOfWeek = today.day(); 
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 
    const monday = today.subtract(diff, 'day');

    const weekDays = Array.from({ length: 7 }).map((_, i) => monday.add(i, 'day'));
    
    const thisWeekLogs = logs.filter(log => {
      const logDate = dayjs(log.activity_date);
      return logDate.isAfter(monday.subtract(1, 'day')) && logDate.isBefore(monday.add(7, 'day'));
    });

    const uniqueActiveDates = new Set(thisWeekLogs.map(log => log.activity_date));
    const activityCount = uniqueActiveDates.size;

    let medal = { color: "#8c8c8c", text: "아직 메달이 없습니다 🏃", styleClass: "" };
    if (activityCount >= 5) medal = { color: "#fadb14", text: "금메달 달성! 🥇", styleClass: "flashy-medal-gold" };
    else if (activityCount >= 3) medal = { color: "#d3d3d3", text: "은메달 달성! 🥈", styleClass: "flashy-medal-silver" };
    else if (activityCount >= 1) medal = { color: "#d48806", text: "동메달 달성! 🥉", styleClass: "flashy-medal-bronze" };

    return { weekDays, thisWeekLogs, activityCount, medal, monday };
  };

  // ----- 통계 데이터 생성 로직 -----
  const generateChartData = (monday: dayjs.Dayjs) => {
    // 1. 주간 데이터 (월~일)
    const weeklyChart = Array.from({ length: 7 }).map((_, i) => {
      const targetDay = monday.add(i, 'day');
      const dateStr = targetDay.format("YYYY-MM-DD");
      const dayLogs = logs.filter(log => log.activity_date === dateStr);
      const totalHours = dayLogs.reduce((acc, log) => acc + getDurationHours(log.start_time, log.end_time), 0);
      return { name: targetDay.format("ddd"), 시간: totalHours };
    });

    // 2. 월간 데이터 (현재 월의 1~5주차)
    const currentMonth = dayjs().month();
    const monthlyChart = Array.from({ length: 5 }).map((_, i) => ({ name: `${i + 1}주차`, 시간: 0 }));
    
    logs.forEach(log => {
      const logDate = dayjs(log.activity_date);
      if (logDate.month() === currentMonth) {
        // 해당 월의 첫 번째 날을 기준으로 주차 계산
        const firstDayOfMonth = logDate.startOf('month');
        const weekOfMonth = Math.ceil((logDate.date() + firstDayOfMonth.day() - 1) / 7);
        if(weekOfMonth >= 1 && weekOfMonth <= 5) {
          monthlyChart[weekOfMonth - 1].시간 += getDurationHours(log.start_time, log.end_time);
        }
      }
    });

    // 3. 연간 데이터 (1~12월)
    const currentYear = dayjs().year();
    const yearlyChart = Array.from({ length: 12 }).map((_, i) => ({ name: `${i + 1}월`, 시간: 0 }));
    
    logs.forEach(log => {
      const logDate = dayjs(log.activity_date);
      if (logDate.year() === currentYear) {
        yearlyChart[logDate.month()].시간 += getDurationHours(log.start_time, log.end_time);
      }
    });

    // 소수점 정리
    monthlyChart.forEach(d => d.시간 = Number(d.시간.toFixed(1)));
    yearlyChart.forEach(d => d.시간 = Number(d.시간.toFixed(1)));

    return { weeklyChart, monthlyChart, yearlyChart };
  };

  const getDurationString = (start: string, end: string) => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins < 0) diffMins += 24 * 60; 
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    if (h > 0 && m > 0) return `${h}시간 ${m}분`;
    if (h > 0) return `${h}시간`;
    return `${m}분`;
  };

  const dateCellRender = (value: dayjs.Dayjs) => {
    const dateString = value.format("YYYY-MM-DD");
    const dayLogs = logs.filter(log => log.activity_date === dateString);
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {dayLogs.map((log, index) => (
          <li key={index}>
            <Badge status="success" text={`${log.tool_used} (${getDurationString(log.start_time, log.end_time)})`} />
          </li>
        ))}
      </ul>
    );
  };

  const disabledDate = (current: dayjs.Dayjs) => {
    const today = dayjs().endOf('day');
    const aWeekAgo = dayjs().subtract(7, 'day').startOf('day');
    return current && (current > today || current < aWeekAgo);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;

  const { weekDays, thisWeekLogs, activityCount, medal, monday } = getWeeklyData();
  const { weeklyChart, monthlyChart, yearlyChart } = generateChartData(monday);

  return (
    // ConfigProvider를 통해 어르신들이 보기 편하게 전체 폰트 크기 및 색상 조절
    <ConfigProvider theme={{ token: { fontSize: 16, colorText: '#262626', colorPrimary: '#1890ff' } }}>
      <div style={{ backgroundColor: '#f0f5fa', minHeight: '100vh', padding: '30px 0' }}>
        
        {/* 애니메이션 스타일 정의 (메달 반짝임 효과) */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes bounceAndShineGold {
            0%, 100% { transform: translateY(0) scale(1); text-shadow: 0 0 10px rgba(250, 219, 20, 0.5); }
            50% { transform: translateY(-8px) scale(1.1); text-shadow: 0 0 25px rgba(250, 219, 20, 1), 0 0 15px rgba(255, 255, 255, 0.8); }
          }
          @keyframes shineSilver {
            0%, 100% { transform: scale(1); text-shadow: 0 0 5px rgba(211, 211, 211, 0.5); }
            50% { transform: scale(1.05); text-shadow: 0 0 20px rgba(211, 211, 211, 1), 0 0 10px rgba(255, 255, 255, 0.8); }
          }
          @keyframes shineBronze {
            0%, 100% { transform: scale(1); text-shadow: 0 0 5px rgba(212, 136, 6, 0.5); }
            50% { transform: scale(1.05); text-shadow: 0 0 15px rgba(212, 136, 6, 1); }
          }
          .flashy-medal-gold { animation: bounceAndShineGold 1.5s infinite ease-in-out; }
          .flashy-medal-silver { animation: shineSilver 2s infinite ease-in-out; }
          .flashy-medal-bronze { animation: shineBronze 2s infinite ease-in-out; }
        `}} />

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px" }}>
          
          {/* 기존 헤더 부분 수정 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <Title level={2} style={{ margin: 0, color: '#003eb3' }}>나의 전도 다이어리 📖</Title>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* 관리자일 경우에만 버튼 노출 */}
              {member?.is_admin && (
                <Button size="large" type="primary" danger onClick={() => router.push('/admin')}>
                  관리자 페이지
                </Button>
              )}
              <Button size="large" onClick={handleLogout}>로그아웃</Button>
            </div>
          </div>

          {/* 내 정보 카드 */}
          <Card 
            style={{ marginBottom: 24, borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", backgroundColor: '#ffffff' }}
            title={<Title level={4} style={{margin:0}}><UserOutlined /> 내 정보</Title>}
          >
            <Row gutter={[16, 24]}>
              <Col xs={12} sm={8}><Text type="secondary">이름</Text><div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{member?.name}</div></Col>
              <Col xs={12} sm={8}><Text type="secondary">고유번호</Text><div style={{ fontSize: '1.1rem' }}>{member?.member_no}</div></Col>
              <Col xs={12} sm={8}><Text type="secondary">부서</Text><div style={{ fontSize: '1.1rem' }}>{member?.department || "미배정"}</div></Col>
              <Col xs={12} sm={8}><Text type="secondary">지역</Text><div style={{ fontSize: '1.1rem' }}>{member?.region || "-"}</div></Col>
              <Col xs={12} sm={8}><Text type="secondary">팀</Text><div style={{ fontSize: '1.1rem' }}>{member?.team || "-"}</div></Col>
              <Col xs={12} sm={8}><Text type="secondary">구역</Text><div style={{ fontSize: '1.1rem' }}>{member?.sector || "-"}</div></Col>
            </Row>
          </Card>

          {/* 주간 활동 스탬프 (게이미피케이션) */}
          <Card style={{ marginBottom: 24, borderRadius: 16, textAlign: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.08)", border: '2px solid #e6f7ff' }}>
            <Title level={3} style={{ marginBottom: 20 }}>주간 활동 스탬프 (이번 주: {activityCount}일)</Title>
            
            {/* 화려한 메달 표시 */}
            <div style={{ margin: "30px 0" }}>
              <div 
                className={medal.styleClass}
                style={{ 
                  display: 'inline-block', fontSize: '28px', fontWeight: "bold", 
                  color: medal.color, padding: '10px 20px', borderRadius: '50px', 
                  backgroundColor: activityCount >= 1 ? '#fff' : 'transparent' 
                }}
              >
                <TrophyOutlined style={{ marginRight: 8 }} /> {medal.text}
              </div>
            </div>

            <Row justify="center" gutter={12}>
              {weekDays.map((day, idx) => {
                const dateStr = day.format("YYYY-MM-DD");
                const hasActivity = thisWeekLogs.some(log => log.activity_date === dateStr);
                const isToday = day.isSame(dayjs(), 'day');
                
                return (
                  <Col key={idx} style={{ textAlign: "center", minWidth: '60px' }}>
                    <div style={{ marginBottom: 8, fontSize: '1.1rem', fontWeight: isToday ? 'bold' : 'normal', color: isToday ? '#1890ff' : 'inherit' }}>
                      {day.format("ddd")}
                    </div>
                    <div style={{ fontSize: 42, marginBottom: 8 }}>
                      {hasActivity ? (
                        <CheckCircleFilled style={{ color: "#52c41a", filter: 'drop-shadow(0px 4px 6px rgba(82, 196, 26, 0.4))' }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: "#d9d9d9" }} />
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: "#8c8c8c" }}>{day.format("M/D")}</div>
                  </Col>
                );
              })}
            </Row>
            
            <Button 
              type="primary" 
              size="large" 
              icon={<PlusOutlined />} 
              style={{ marginTop: 32, width: "100%", maxWidth: 350, height: '50px', fontSize: '1.2rem', borderRadius: 25, boxShadow: '0 4px 10px rgba(24,144,255,0.4)' }}
              onClick={() => setIsReportModalOpen(true)}
            >
              오늘의 활동 보고하기
            </Button>
          </Card>

          {/* 상세 내역 조회 탭 (달력 + 통계) */}
          <Card style={{ borderRadius: 16, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <Tabs
              defaultActiveKey="1"
              size="large"
              items={[
                {
                  key: "1",
                  label: <><BarChartOutlined /> 통계 및 그래프</>,
                  children: (
                    <Tabs defaultActiveKey="week" type="card" style={{ marginTop: 20 }}>
                      <Tabs.TabPane tab="이번 주 활동" key="week">
                        <div style={{ padding: '20px 0' }}>
                          <Title level={4} style={{ textAlign: 'center', marginBottom: 20 }}>요일별 활동 시간 (시간)</Title>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={weeklyChart}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis allowDecimals={true} />
                              <Tooltip formatter={(value) => [`${value} 시간`, '활동 시간']} />
                              <Bar dataKey="시간" fill="#1890ff" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </Tabs.TabPane>
                      <Tabs.TabPane tab="월간 활동" key="month">
                        <div style={{ padding: '20px 0' }}>
                          <Title level={4} style={{ textAlign: 'center', marginBottom: 20 }}>주차별 활동 시간 (이번 달)</Title>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={monthlyChart}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip formatter={(value) => [`${value} 시간`, '활동 시간']} />
                              <Line type="monotone" dataKey="시간" stroke="#52c41a" strokeWidth={3} activeDot={{ r: 8 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </Tabs.TabPane>
                      <Tabs.TabPane tab="연간 활동" key="year">
                        <div style={{ padding: '20px 0' }}>
                          <Title level={4} style={{ textAlign: 'center', marginBottom: 20 }}>월별 활동 시간 (올해)</Title>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={yearlyChart}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip formatter={(value) => [`${value} 시간`, '활동 시간']} />
                              <Bar dataKey="시간" fill="#722ed1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </Tabs.TabPane>
                    </Tabs>
                  )
                },
                {
                  key: "2",
                  label: "활동 달력 보기",
                  children: <Calendar cellRender={dateCellRender} style={{ marginTop: 20 }} />
                }
              ]}
            />
          </Card>

          {/* 신규 등록 모달 */}
          <Modal
            title={<Title level={3}>나의 전도 활동 보고</Title>}
            open={isReportModalOpen}
            onCancel={() => setIsReportModalOpen(false)}
            footer={null}
            width={600}
          >
            <Form form={form} layout="vertical" onFinish={handleReportSubmit} size="large" style={{ marginTop: 20 }}>
              <Form.Item name="activity_date" label="활동 날짜" rules={[{ required: true, message: "날짜를 선택해주세요." }]} initialValue={dayjs()}>
                <DatePicker style={{ width: "100%" }} disabledDate={disabledDate} />
              </Form.Item>
              
              <Form.Item name="time_range" label="시작/종료 시간" rules={[{ required: true, message: "시간을 선택해주세요." }]}>
                <TimePicker.RangePicker format="HH:mm" style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item name="tool_used" label="활동 도구" rules={[{ required: true, message: "도구를 선택해주세요." }]}>
                <Select placeholder="활동 도구 선택">
                  {ACTIVITY_TOOLS.map((tool) => (
                    <Select.Option key={tool} value={tool}>{tool}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="find_1_count" label="찾1 결과 (명)" initialValue={0}>
                    <Input type="number" min={0} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="find_2_count" label="찾2 결과 (명)" initialValue={0}>
                    <Input type="number" min={0} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="description" label="활동 내역 (500자 이내)">
                <TextArea rows={4} maxLength={500} placeholder="오늘의 활동 내역이나 소감을 자유롭게 적어주세요." />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block size="large" style={{ height: '50px', fontSize: '1.2rem', borderRadius: 8 }}>
                  보고서 제출하기
                </Button>
              </Form.Item>
            </Form>
          </Modal>

        </div>
      </div>
    </ConfigProvider>
  );
}