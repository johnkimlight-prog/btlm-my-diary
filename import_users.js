// import_users.js (로컬에서 1회성으로만 실행하는 스크립트)
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

// 🚨 주의: 이 작업은 최고 관리자 권한(service_role key)이 필요합니다. 
// Supabase 대시보드 API 설정에서 service_role 키를 복사해오세요. (절대 프론트엔드 코드에 넣지 마세요!)
const supabaseUrl = 'https://kmchppnuacalmamqfxhz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttY2hwcG51YWNhbG1hbXFmeGh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDg2ODEzMCwiZXhwIjoyMTAwNDQ0MTMwfQ.ItpYPRVf3_xGOiKreYwwf6wzkU3bOMh_2k62alNU1EQ';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncUsers() {
  const users = [];
  fs.createReadStream('users.csv')
    .pipe(csv({
      mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, '')
    }))
    .on('data', (row) => users.push(row))
    .on('end', async () => {
      console.log(`총 ${users.length}명의 데이터를 동기화합니다...`);
      
      let newCount = 0;
      let updateCount = 0;

      for (const user of users) {
        const memberNo = user.member_no; // CSV 헤더에 맞게 조정 (예: user.고유번호)
        const email = `${memberNo}@ydp.com`;

        // 1. members 테이블에 해당 고유번호가 이미 있는지 확인
        const { data: existingUser } = await supabase
          .from('members')
          .select('id')
          .eq('member_no', memberNo)
          .single();

        if (existingUser) {
          // [기존 유저] -> 소속 정보만 최신 엑셀에 맞게 업데이트 (Auth는 건드릴 필요 없음)
          const { error: updateError } = await supabase
            .from('members')
            .update({
              name: user.name,
              department: user.department,
              region: user.region
            })
            .eq('member_no', memberNo);

          if (!updateError) updateCount++;
        } else {
          // [신규 유저] -> Auth 계정 먼저 만들고 DB에 Insert
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: '000000',
            email_confirm: true,
          });

          if (!authError) {
            const { error: insertError } = await supabase.from('members').insert([{
              id: authData.user.id,
              member_no: memberNo,
              name: user.name,
              department: user.department,
              region: user.region,
            }]);
            
            if (!insertError) newCount++;
          }
        }
      }
      
      console.log('🎉 데이터 동기화 완료!');
      console.log(`- 신규 가입(Insert): ${newCount}명`);
      console.log(`- 정보 갱신(Update): ${updateCount}명`);
    });
}

syncUsers();