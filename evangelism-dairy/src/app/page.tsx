"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  Card, Button, Typography, Row, Col, Badge, Modal, Form, 
  Input, Select, DatePicker, TimePicker, Tabs, Calendar, Spin, ConfigProvider, App, Popconfirm, Divider
} from "antd";
import { 
  TrophyOutlined, EditOutlined, PlusOutlined, CheckCircleFilled, CloseCircleOutlined, 
  BarChartOutlined, CalendarOutlined, InfoCircleOutlined 
} from "@ant-design/icons";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, LabelList 
} from "recharts";
import dayjs from "dayjs";
import 'dayjs/locale/ko';
import weekOfYear from "dayjs/plugin/weekOfYear";
// 💡 달력 등 Ant Design 컴포넌트 전면 한글화를 위한 로케일 임포트
import koKR from 'antd/locale/ko_KR';

dayjs.extend(weekOfYear);
dayjs.locale('ko');

const { Title, Text } = Typography;
const { TextArea } = Input;

const ACTIVITY_TOOLS = ["노방", "지인", "온라인", "기타"];
const REGION_MAP: Record<string, string[]> = {
  "장년부": ["장년 1지역", "장년 2지역", "장년 3지역"],
  "부녀부": ["부녀 1지역", "부녀 2지역", "부녀 3지역"],
  "청년부": ["대학부", "직장인부", "새내기부"],
  "교역": ["본부", "지부", "센터"],
  "미배정": ["-"]
};
const MINT_COLOR = "#13c2c2"; 

export default function DashboardPage() {
  const { message } = App.useApp(); 
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const [calendarValue, setCalendarValue] = useState(() => dayjs());
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDateLogs, setSelectedDateLogs] = useState<any[]>([]);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);

  // 💡 누적 내역 날짜 필터 상태 (기본값: 올해 1월 1일 ~ 현재)
  const [statsRange, setStatsRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('year'), dayjs()]);

  const [form] = Form.useForm();
  const [profileForm] = Form.useForm();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) { router.push("/login"); return; }
    const { data: memberData } = await supabase.from("members").select("*").eq("id", user.id).single();
    if (memberData) {
      setMember(memberData);
      fetchActivityLogs(user.id);
    } else {
      message.error("등록된 성도 프로필 정보가 없습니다.");
      setLoading(false);
    }
  };

  const fetchActivityLogs = async (memberId: string) => {
    const { data: logData } = await supabase.from("activity_logs").select("*").eq("member_id", memberId).order("activity_date", { ascending: false });
    if (logData) {
      setLogs(logData);
      if (isDetailModalOpen) {
        const dateStr = calendarValue.format("YYYY-MM-DD");
        setSelectedDateLogs(logData.filter(log => log.activity_date === dateStr));
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleProfileUpdate = async (values: any) => {
    const { error } = await supabase.from("members").update({ region: values.region, team: values.team, sector: values.sector }).eq("id", member.id);
    if (error) message.error("소속 정보 수정에 실패했습니다.");
    else { message.success("소속 정보가 수정되었습니다."); setIsProfileModalOpen(false); fetchUserData(); }
  };

  const openReportModal = () => {
    setIsEditMode(false);
    setCurrentEditId(null);
    form.setFieldsValue({
      activity_date: dayjs(),
      time_range: [dayjs().subtract(1, 'hour'), dayjs()],
      tool_used: undefined,
      find_1_count: 0,
      find_2_count: 0,
      description: ""
    });
    setIsReportModalOpen(true);
  };

  const openEditModal = (log: any) => {
    setIsEditMode(true);
    setCurrentEditId(log.id);
    form.setFieldsValue({
      activity_date: dayjs(log.activity_date),
      time_range: [dayjs(`${log.activity_date} ${log.start_time}`), dayjs(`${log.activity_date} ${log.end_time}`)],
      tool_used: log.tool_used,
      find_1_count: log.find_1_count,
      find_2_count: log.find_2_count,
      description: log.description
    });
    setIsDetailModalOpen(false); 
    setIsReportModalOpen(true);  
  };

  const handleDeleteLog = async (logId: string) => {
    const { error } = await supabase.from('activity_logs').delete().eq('id', logId);
    if (error) message.error("삭제에 실패했습니다.");
    else {
      message.success("활동 기록이 삭제되었습니다.");
      fetchActivityLogs(member.id);
    }
  };

  const handleReportSubmit = async (values: any) => {
    const dateStr = values.activity_date.format("YYYY-MM-DD");
    const newStart = values.time_range[0].format("HH:mm");
    const newEnd = values.time_range[1].format("HH:mm");

    const isOverlapping = logs.some(log => {
      if (isEditMode && log.id === currentEditId) return false;
      if (log.activity_date !== dateStr) return false;
      const existingStart = log.start_time.slice(0, 5);
      const existingEnd = log.end_time.slice(0, 5);
      return (newStart < existingEnd) && (newEnd > existingStart);
    });

    if (isOverlapping) {
      message.error("해당 날짜와 겹치는 활동 시간이 이미 보고되어 있습니다.");
      return;
    }

    const payload = {
      member_id: member.id, activity_date: dateStr, start_time: newStart, end_time: newEnd,
      tool_used: values.tool_used, find_1_count: values.find_1_count || 0, find_2_count: values.find_2_count || 0, description: values.description
    };

    if (isEditMode) {
      const { error } = await supabase.from("activity_logs").update(payload).eq("id", currentEditId);
      if (error) message.error("수정에 실패했습니다.");
      else { message.success("활동이 성공적으로 수정되었습니다!"); setIsReportModalOpen(false); fetchActivityLogs(member.id); }
    } else {
      const { error } = await supabase.from("activity_logs").insert([payload]);
      if (error) message.error("보고에 실패했습니다.");
      else { message.success("활동이 성공적으로 보고되었습니다!"); setIsReportModalOpen(false); fetchActivityLogs(member.id); }
    }
  };

  const onCalendarSelect = (newValue: dayjs.Dayjs, info: any) => {
    setCalendarValue(newValue);
    if (info.source === 'date') {
      const dateString = newValue.format("YYYY-MM-DD");
      const dayLogs = logs.filter(log => log.activity_date === dateString);
      setSelectedDateLogs(dayLogs);
      setIsDetailModalOpen(true);
    }
  };

  const getDurationHours = (start: string, end: string) => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins < 0) diffMins += 24 * 60;
    return Number((diffMins / 60).toFixed(1));
  };

  const formatMinsToString = (mins: number) => {
    if (mins === 0) return '0분';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}시간 ${m}분`;
    if (h > 0) return `${h}시간`;
    return `${m}분`;
  };

  const dateCellRender = (value: dayjs.Dayjs) => {
    const dateString = value.format("YYYY-MM-DD");
    const dayLogs = logs.filter(log => log.activity_date === dateString);
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {dayLogs.map((log, index) => {
          const durationHrs = getDurationHours(log.start_time, log.end_time);
          const durationStr = durationHrs >= 1 ? `${Math.floor(durationHrs)}h` : `${Math.round(durationHrs * 60)}m`;
          const resultCount = log.find_1_count + log.find_2_count;
          const resultText = resultCount > 0 ? `${resultCount}명` : '없음';
          
          return (
            <li key={index} style={{ marginBottom: 2 }}>
              <Badge 
                color={MINT_COLOR} 
                style={{ fontSize: '10px', whiteSpace: 'normal', display: 'flex', alignItems: 'flex-start', lineHeight: '1.2' }} 
                text={<span><strong>{log.tool_used}</strong> ({durationStr}/{resultText})</span>} 
              />
            </li>
          );
        })}
      </ul>
    );
  };

  const disabledDate = (current: dayjs.Dayjs) => current && (current > dayjs().endOf('day') || current < dayjs().subtract(7, 'day').startOf('day'));

  const getWeeklyData = () => {
    const today = dayjs();
    const diff = today.day() === 0 ? 6 : today.day() - 1; 
    const monday = today.subtract(diff, 'day');
    const weekDays = Array.from({ length: 7 }).map((_, i) => monday.add(i, 'day'));
    const thisWeekLogs = logs.filter(log => dayjs(log.activity_date).isAfter(monday.subtract(1, 'day')) && dayjs(log.activity_date).isBefore(monday.add(7, 'day')));
    const activityCount = new Set(thisWeekLogs.map(log => log.activity_date)).size;
    let medal = { color: "#8c8c8c", text: "아직 메달이 없습니다 🏃", styleClass: "" };
    if (activityCount >= 5) medal = { color: "#fadb14", text: "금메달 달성! 🥇", styleClass: "flashy-medal-gold" };
    else if (activityCount >= 3) medal = { color: "#d3d3d3", text: "은메달 달성! 🥈", styleClass: "flashy-medal-silver" };
    else if (activityCount >= 1) medal = { color: "#d48806", text: "동메달 달성! 🥉", styleClass: "flashy-medal-bronze" };
    return { weekDays, thisWeekLogs, activityCount, medal, monday };
  };

  const generateChartData = (monday: dayjs.Dayjs) => {
    const weeklyChart = Array.from({ length: 7 }).map((_, i) => {
      const targetDay = monday.add(i, 'day');
      const totalHours = logs.filter(l => l.activity_date === targetDay.format("YYYY-MM-DD")).reduce((acc, log) => acc + getDurationHours(log.start_time, log.end_time), 0);
      return { name: targetDay.format("ddd"), 시간: totalHours };
    });
    const monthlyChart = Array.from({ length: 5 }).map((_, i) => ({ name: `${i + 1}주차`, 시간: 0 }));
    const yearlyChart = Array.from({ length: 12 }).map((_, i) => ({ name: `${i + 1}월`, 시간: 0 }));
    logs.forEach(log => {
      const logDate = dayjs(log.activity_date);
      if (logDate.month() === dayjs().month()) {
        const weekOfMonth = Math.ceil((logDate.date() + logDate.startOf('month').day() - 1) / 7);
        if(weekOfMonth >= 1 && weekOfMonth <= 5) monthlyChart[weekOfMonth - 1].시간 += getDurationHours(log.start_time, log.end_time);
      }
      if (logDate.year() === dayjs().year()) yearlyChart[logDate.month()].시간 += getDurationHours(log.start_time, log.end_time);
    });
    return { weeklyChart, monthlyChart, yearlyChart };
  };

  // 💡 평균 찾기 시간 연산 및 기간 필터 적용
  const calculateStats = () => {
    let totalMins = 0, totalFind1 = 0, totalFind2 = 0;
    
    // 설정된 날짜 범위 내의 로그만 필터링
    const filteredLogs = logs.filter(log => {
      const logDate = dayjs(log.activity_date);
      return logDate.isAfter(statsRange[0].subtract(1, 'day')) && logDate.isBefore(statsRange[1].add(1, 'day'));
    });

    filteredLogs.forEach(log => {
      totalMins += Math.round(getDurationHours(log.start_time, log.end_time) * 60);
      totalFind1 += (log.find_1_count || 0);
      totalFind2 += (log.find_2_count || 0);
    });

    const totalHoursFloat = totalMins / 60;
    const find1PerHour = totalHoursFloat > 0 ? (totalFind1 / totalHoursFloat).toFixed(2) : "0.00";
    const find2PerHour = totalHoursFloat > 0 ? (totalFind2 / totalHoursFloat).toFixed(2) : "0.00";

    const avgFind1Mins = totalFind1 > 0 ? Math.round(totalMins / totalFind1) : 0;
    const avgFind2Mins = totalFind2 > 0 ? Math.round(totalMins / totalFind2) : 0;

    const today = dayjs();
    const diff = today.day() === 0 ? 6 : today.day() - 1;
    const monday = today.subtract(diff, 'day');
    const thisWeekLogs = logs.filter(log => dayjs(log.activity_date).isAfter(monday.subtract(1, 'day')) && dayjs(log.activity_date).isBefore(monday.add(7, 'day')));
    
    let weeklyMins = 0, weeklyFind1 = 0, weeklyFind2 = 0;
    thisWeekLogs.forEach(log => {
      weeklyMins += Math.round(getDurationHours(log.start_time, log.end_time) * 60);
      weeklyFind1 += (log.find_1_count || 0);
      weeklyFind2 += (log.find_2_count || 0);
    });

    return { totalMins, totalFind1, totalFind2, avgFind1Mins, avgFind2Mins, weeklyMins, weeklyFind1, weeklyFind2, find1PerHour, find2PerHour };
  };

  // 💡 소속 텍스트 자동 변환 함수 (0-0 또는 0구역)
  const getTeamSectorString = () => {
    const t = member?.team;
    const s = member?.sector;
    if (t && s) return `${t}-${s}`;
    if (!t && s) return `${s}구역`;
    return "";
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;

  const { weekDays, thisWeekLogs, activityCount, medal, monday } = getWeeklyData();
  const { weeklyChart, monthlyChart, yearlyChart } = generateChartData(monday);
  const stats = calculateStats();

  const renderCustomLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value || value === 0) return null;
    return <text x={x + width / 2} y={y - 10} fill="#666" textAnchor="middle" fontSize={13}>{value}h</text>;
  };
  const renderLineLabel = (props: any) => {
    const { x, y, value } = props;
    if (!value || value === 0) return null;
    return <text x={x} y={y - 15} fill="#666" textAnchor="middle" fontSize={13}>{value}h</text>;
  };

  const tabItems = [
    {
      key: "1", label: <><BarChartOutlined /> 통계</>, children: (
        <Tabs defaultActiveKey="week" type="card" style={{ marginTop: 10 }} items={[
          { key: "week", label: "이번 주", children: 
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weeklyChart} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis allowDecimals={true} tick={{fontSize: 12}} width={30} />
                <Tooltip formatter={(val: number) => `${val}시간`} />
                <Bar dataKey="시간" fill={MINT_COLOR} radius={[4, 4, 0, 0]} barSize={25}><LabelList content={renderCustomLabel} /></Bar>
              </BarChart>
            </ResponsiveContainer> 
          },
          { key: "month", label: "이번 달", children: 
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyChart} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} width={30} />
                <Tooltip formatter={(val: number) => `${val}시간`} />
                <Line type="monotone" dataKey="시간" stroke={MINT_COLOR} strokeWidth={3} activeDot={{ r: 6 }}><LabelList content={renderLineLabel} /></Line>
              </LineChart>
            </ResponsiveContainer> 
          },
          { key: "year", label: "올해", children: 
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={yearlyChart} margin={{ top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} width={30} />
                <Tooltip formatter={(val: number) => `${val}시간`} />
                <Bar dataKey="시간" fill={MINT_COLOR} radius={[4, 4, 0, 0]} barSize={20}><LabelList content={renderCustomLabel} /></Bar>
              </BarChart>
            </ResponsiveContainer> 
          }
        ]} />
      )
    },
    { 
      key: "2", label: <><CalendarOutlined /> 달력</>, children: (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <Button size="small" type="primary" onClick={() => setCalendarValue(dayjs())}>오늘로 이동</Button>
          </div>
          <div style={{ minWidth: '400px' }}>
            <Calendar value={calendarValue} onSelect={onCalendarSelect} cellRender={dateCellRender} />
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 10, textAlign: 'center', fontSize: '0.85rem' }}>💡 날짜 칸을 터치하면 상세 내용을 봅니다.</Text>
        </div>
      ) 
    }
  ];

  return (
    // 💡 달력과 DatePicker 완벽 한글화를 위한 locale={koKR} 추가
    <ConfigProvider locale={koKR} theme={{ token: { fontSize: 15, colorText: '#262626', colorPrimary: MINT_COLOR } }}>
      <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
        
        <div className="side-banner" style={{ width: 160, padding: '20px 10px', display: 'none', position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ width: '100%', height: 600, backgroundColor: '#e6fffb', borderRadius: 8, border: `1px dashed ${MINT_COLOR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
            <Text style={{ color: MINT_COLOR, fontWeight: 'bold' }}>좌측 긴 배너<br/>(160 x 600)</Text>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 600, padding: '12px', display: 'flex', flexDirection: 'column' }}>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes bounceAndShineGold { 0%, 100% { transform: translateY(0) scale(1); text-shadow: 0 0 10px rgba(250, 219, 20, 0.5); } 50% { transform: translateY(-5px) scale(1.05); text-shadow: 0 0 20px rgba(250, 219, 20, 1), 0 0 10px rgba(255, 255, 255, 0.8); } }
            @keyframes shineSilver { 0%, 100% { transform: scale(1); text-shadow: 0 0 5px rgba(211, 211, 211, 0.5); } 50% { transform: scale(1.03); text-shadow: 0 0 15px rgba(211, 211, 211, 1), 0 0 10px rgba(255, 255, 255, 0.8); } }
            @keyframes shineBronze { 0%, 100% { transform: scale(1); text-shadow: 0 0 5px rgba(212, 136, 6, 0.5); } 50% { transform: scale(1.03); text-shadow: 0 0 10px rgba(212, 136, 6, 1); } }
            .flashy-medal-gold { animation: bounceAndShineGold 1.5s infinite ease-in-out; } .flashy-medal-silver { animation: shineSilver 2s infinite ease-in-out; } .flashy-medal-bronze { animation: shineBronze 2s infinite ease-in-out; }
            @media (min-width: 1000px) { .side-banner { display: flex !important; } }
            .compact-stats .ant-typography { margin-bottom: 2px !important; }
          `}} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Title level={4} style={{ margin: 0, color: '#262626' }}>나의 전도 다이어리 📖</Title>
            <div style={{ display: 'flex', gap: '6px' }}>
              {member?.is_admin && <Button size="small" type="primary" danger onClick={() => router.push('/admin')}>관리자</Button>}
              <Button size="small" onClick={handleLogout}>로그아웃</Button>
            </div>
          </div>
          
          <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: '#fff', borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", borderLeft: `4px solid ${MINT_COLOR}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#262626', marginBottom: 4 }}>
                {member?.name} <Text type="secondary" style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>({member?.member_no})</Text>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#595959' }}>
                {member?.department || "미배정"} / {member?.region || "-"} 
                {getTeamSectorString() ? ` / ${getTeamSectorString()}` : ""}
              </div>
            </div>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { profileForm.setFieldsValue({ region: member?.region, team: member?.team, sector: member?.sector }); setIsProfileModalOpen(true); }} style={{ padding: 0, color: MINT_COLOR }}>수정</Button>
          </div>

          <div style={{ width: '100%', minHeight: 60, backgroundColor: '#e6fffb', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${MINT_COLOR}` }}>
            <Text style={{ color: MINT_COLOR, fontSize: '0.9rem' }}>상단 배너 공간</Text>
          </div>

          {/* 💡 워닝 해결: styles={{ body: {...} }} 형태 사용 */}
          <Card styles={{ body: { padding: '16px' } }} style={{ marginBottom: 16, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: `1px solid #e6fffb` }}>
            <div className="compact-stats">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <InfoCircleOutlined style={{ color: MINT_COLOR, marginRight: 6 }} /> 
                  <Text strong style={{ fontSize: '1rem', color: MINT_COLOR }}>내 활동 누적 내역</Text>
                </div>
              </div>

              {/* 💡 누적 내역 날짜 필터 추가 */}
              <DatePicker.RangePicker 
                value={statsRange} 
                onChange={(dates) => { if(dates && dates[0] && dates[1]) setStatsRange([dates[0], dates[1]]) }}
                style={{ width: '100%', marginBottom: 12 }}
                size="small"
                allowClear={false}
                inputReadOnly={true}
              />

              <Row gutter={[0, 4]}>
                <Col span={24}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>총 활동 시간 :</Text> <Text strong>{formatMinsToString(stats.totalMins)}</Text></Col>
                <Col span={24}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>총 찾기 수 :</Text> <Text strong>찾1 {stats.totalFind1}명, 찾2 {stats.totalFind2}명</Text></Col>
                {/* 💡 시간당 찾기가 아닌 '평균 찾기 시간'으로 계산되어 표기됨 */}
                <Col span={24}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>평균 찾기 시간 :</Text> <Text strong>찾1 1개 당 {stats.avgFind1Mins ? formatMinsToString(stats.avgFind1Mins) : '없음'}, 찾2 1개 당 {stats.avgFind2Mins ? formatMinsToString(stats.avgFind2Mins) : '없음'}</Text></Col>
                <Col span={24}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>시간당 찾기 :</Text> <Text strong>찾1 {stats.find1PerHour}명, 찾2 {stats.find2PerHour}명</Text></Col>                
              </Row>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <CalendarOutlined style={{ color: MINT_COLOR, marginRight: 6 }} /> 
                <Text strong style={{ fontSize: '1rem', color: MINT_COLOR }}>주간 활동 내역 요약</Text>
              </div>
              <Row gutter={[0, 4]}>
                <Col span={24}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>금주 활동 시간 :</Text> <Text strong>{formatMinsToString(stats.weeklyMins)}</Text></Col>
                <Col span={24}><Text type="secondary" style={{ width: 100, display: 'inline-block' }}>금주 활동 결과 :</Text> <Text strong>찾1 {stats.weeklyFind1}명, 찾2 {stats.weeklyFind2}명</Text></Col>
              </Row>
            </div>
          </Card>

          <Card styles={{ body: { padding: '16px' } }} style={{ marginBottom: 16, borderRadius: 12, textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: `2px solid ${MINT_COLOR}` }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>주간 활동 스탬프 (이번 주: {activityCount}일)</Title>
            
            <div style={{ marginBottom: 20 }}>
              <div className={medal.styleClass} style={{ display: 'inline-block', fontSize: '20px', fontWeight: "bold", color: medal.color, padding: '4px 16px', borderRadius: '50px', backgroundColor: activityCount >= 1 ? '#fff' : 'transparent' }}>
                <TrophyOutlined style={{ marginRight: 6 }} /> {medal.text}
              </div>
            </div>

            <Row justify="center" gutter={6}>
              {weekDays.map((day, idx) => {
                const dateStr = day.format("YYYY-MM-DD");
                const hasActivity = thisWeekLogs.some(log => log.activity_date === dateStr);
                const isToday = day.isSame(dayjs(), 'day');
                return (
                  <Col key={idx} style={{ textAlign: "center", minWidth: '40px', padding: '0 2px' }}>
                    <div style={{ marginBottom: 4, fontSize: '0.9rem', fontWeight: isToday ? 'bold' : 'normal', color: isToday ? MINT_COLOR : 'inherit' }}>{day.format("dd")}</div>
                    <div style={{ fontSize: 32, marginBottom: 4 }}>{hasActivity ? <CheckCircleFilled style={{ color: MINT_COLOR, filter: 'drop-shadow(0px 2px 4px rgba(19, 194, 194, 0.4))' }} /> : <CloseCircleOutlined style={{ color: "#d9d9d9" }} />}</div>
                    <div style={{ fontSize: '0.75rem', color: "#8c8c8c" }}>{day.format("D")}</div>
                  </Col>
                );
              })}
            </Row>
            
            <Button type="primary" size="large" icon={<PlusOutlined />} style={{ marginTop: 24, width: "100%", height: '45px', fontSize: '1.1rem', borderRadius: 25, boxShadow: `0 4px 10px rgba(19, 194, 194, 0.3)` }} onClick={openReportModal}>
              오늘의 활동 보고하기
            </Button>
          </Card>

          <Card styles={{ body: { padding: '12px' } }} style={{ borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <Tabs defaultActiveKey="1" size="middle" items={tabItems} />
          </Card>

          <div style={{ width: '100%', minHeight: 80, backgroundColor: '#e6fffb', borderRadius: 8, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${MINT_COLOR}` }}>
            <Text style={{ color: MINT_COLOR, fontSize: '0.9rem' }}>하단 배너 공간</Text>
          </div>

        </div>

        <div className="side-banner" style={{ width: 160, padding: '20px 10px', display: 'none', position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ width: '100%', height: 600, backgroundColor: '#e6fffb', borderRadius: 8, border: `1px dashed ${MINT_COLOR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
            <Text style={{ color: MINT_COLOR, fontWeight: 'bold' }}>우측 긴 배너<br/>(160 x 600)</Text>
          </div>
        </div>

      </div>

      <Modal title={<Title level={5} style={{margin:0}}>{calendarValue.format("M월 D일")} 활동 상세</Title>} open={isDetailModalOpen} onCancel={() => setIsDetailModalOpen(false)} footer={null} styles={{ body: { padding: '16px 12px' } }}>
        {selectedDateLogs.length > 0 ? (
          selectedDateLogs.map((log, idx) => (
            <Card key={idx} style={{ marginBottom: 12, backgroundColor: '#fafafa', border: `1px solid ${MINT_COLOR}` }} styles={{ body: { padding: 12 } }}>
              <div style={{ marginBottom: 10 }}>
                <Text strong style={{ fontSize: '1.05rem' }}>{log.tool_used}</Text>
                <Text type="secondary" style={{ marginLeft: 6, fontSize: '0.9rem' }}>({log.start_time.slice(0,5)} ~ {log.end_time.slice(0,5)})</Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Badge status="processing" color={MINT_COLOR} text={<span style={{fontSize:'0.9rem'}}>찾1: {log.find_1_count}명 / 찾2: {log.find_2_count}명</span>} />
              </div>
              <div style={{ padding: 10, backgroundColor: '#fff', borderRadius: 6, border: '1px solid #f0f0f0', fontSize: '0.9rem' }}>
                <Text>{log.description || "상세 내역이 없습니다."}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: '6px' }}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(log)}>수정</Button>
                <Popconfirm title="삭제하시겠습니까?" onConfirm={() => handleDeleteLog(log.id)} okText="삭제" cancelText="취소">
                  <Button size="small" danger>삭제</Button>
                </Popconfirm>
              </div>
            </Card>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <Text type="secondary">보고된 활동이 없습니다.</Text>
            <Button type="primary" size="small" style={{ display: 'block', margin: '16px auto 0' }} onClick={() => { setIsDetailModalOpen(false); openReportModal(); }}>
              새 활동 보고하기
            </Button>
          </div>
        )}
      </Modal>

      <Modal title={<Title level={4} style={{margin:0}}>{isEditMode ? "활동 내용 수정" : "나의 활동 보고"}</Title>} open={isReportModalOpen} onCancel={() => setIsReportModalOpen(false)} footer={null} styles={{ body: { padding: '16px 12px' } }}>
        <Form form={form} layout="vertical" onFinish={handleReportSubmit} size="middle" style={{ marginTop: 16 }}>
          <Form.Item name="activity_date" label="활동 날짜" rules={[{ required: true, message: "선택 필수" }]} style={{ marginBottom: 12 }}>
            <DatePicker style={{ width: "100%" }} disabledDate={disabledDate} />
          </Form.Item>
          <Form.Item name="time_range" label="시작/종료 시간" rules={[{ required: true, message: "선택 필수" }]} style={{ marginBottom: 12 }}>
            <TimePicker.RangePicker format="HH:mm" minuteStep={30} needConfirm={false} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="tool_used" label="활동 도구" rules={[{ required: true, message: "선택 필수" }]} style={{ marginBottom: 12 }}>
            <Select placeholder="도구 선택">{ACTIVITY_TOOLS.map((tool) => (<Select.Option key={tool} value={tool}>{tool}</Select.Option>))}</Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="find_1_count" label="찾1 (명)" initialValue={0} style={{ marginBottom: 12 }}><Input type="number" min={0} /></Form.Item></Col>
            <Col span={12}><Form.Item name="find_2_count" label="찾2 (명)" initialValue={0} style={{ marginBottom: 12 }}><Input type="number" min={0} /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="활동 내역 (선택)" style={{ marginBottom: 16 }}><TextArea rows={3} maxLength={500} placeholder="내역이나 소감을 적어주세요." /></Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" style={{ borderRadius: 8 }}>{isEditMode ? "수정 내용 저장" : "보고서 제출하기"}</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="소속 정보 수정" open={isProfileModalOpen} onCancel={() => setIsProfileModalOpen(false)} footer={null} styles={{ body: { padding: '16px 12px' } }}>
        <Form form={profileForm} layout="vertical" onFinish={handleProfileUpdate} size="middle" style={{ marginTop: 12 }}>
          <Form.Item name="region" label="지역 선택" style={{ marginBottom: 12 }}>
            <Select placeholder="지역을 선택해 주세요">
              {(REGION_MAP[member?.department || "미배정"] || []).map(region => (<Select.Option key={region} value={region}>{region}</Select.Option>))}
            </Select>
          </Form.Item>
          <Form.Item name="team" label="팀" style={{ marginBottom: 12 }}><Input placeholder="예: 1팀" /></Form.Item>
          <Form.Item name="sector" label="구역" style={{ marginBottom: 16 }}><Input placeholder="예: 1구역" /></Form.Item>
          <Button type="primary" htmlType="submit" block size="large" style={{ borderRadius: 8 }}>수정 완료</Button>
        </Form>
      </Modal>
    </ConfigProvider>
  );
}