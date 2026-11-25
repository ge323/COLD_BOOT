'use strict';
/* =========================================================
   COLD_BOOT — 게임 로직
   ---------------------------------------------------------
   1. 기본 설정과 도우미
   2. 이야기 데이터 (인물, 단서, 메신저, 메일, 로그, 파일, 사건표)
   3. 아이콘과 사진
   4. 상태와 저장
   5. 화면 크기 맞추기
   6. 창 관리
   7. 앱 화면 그리기
   8. 관찰 → 단서 기록
   9. 시간 흐름과 사건
   10. 원격 초기화, 회차 끝, 부팅
   11. 수사 노트와 보고서
   12. 엔딩
   13. 배경 (도시, 비)
   14. 입력 연결과 시작
   ========================================================= */


/* ---------------------------------------------------------
   1. 기본 설정과 도우미
   --------------------------------------------------------- */

const W = 1280;              // 게임 화면 너비
const H = 760;               // 게임 화면 높이
const TASKBAR = 48;          // 작업 표시줄 높이
const SEC_PER_MIN = 2;       // 1배속에서 게임 1분 = 실제 2초 → 한 회차 약 4분
const LOOP_LEN = 120;        // 22:00 ~ 24:00
const WIPE_AT = 118;         // 23:58 원격 초기화 시작
const SAVE_KEY = 'coldboot_save_v1';
const TODAY = '11월 20일 금요일';
const COARSE = matchMedia('(pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// '23:41' → 22:00부터 지난 분 (101)
function tm(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h < 12 ? h + 24 : h) * 60 + m - 22 * 60;
}

// 101 → '23:41'
function clockText(t) {
  const total = 22 * 60 + Math.floor(t);
  return pad2(Math.floor(total / 60) % 24) + ':' + pad2(total % 60);
}


/* ---------------------------------------------------------
   2. 이야기 데이터
   --------------------------------------------------------- */

const PEOPLE = {
  seojin: { name: '한서진', ch: '서', color: '#7aa2ff' },
  harin:  { name: '오하린', ch: '하', color: '#ff9cbc' },
  mom:    { name: '엄마',   ch: '엄', color: '#f2c46a' },
  doyun:  { name: '한도윤', ch: '도', color: '#5fd6ac' },
  kang:   { name: '강준혁', ch: '강', color: '#a9b6d6' },
  moon:   { name: '문태경', ch: '문', color: '#c6a4ff' },
};

// 단서: t가 있으면 타임라인에 올라감
const CLUES = {
  memo:      { title: 'COLD_BOOT의 정체', src: '바탕화면 메모', body: '서진의 PC는 매일 22:00에 스냅샷을 뜨고 그 뒤의 통신과 파일 변경을 기록한다. 지금 보는 건 11월 20일 밤의 재생이다.' },
  diary:     { title: '비어 있는 4억 2천만 원', src: '문서 › 업무일지', body: '서진은 11월 14일, 예치금 합계가 4억 2천만 원 모자란 걸 발견했다. 출금 기록에 "에버그린 홀딩스"라는 낯선 거래처가 있다.' },
  assets:    { title: '업무용 PC 자산 목록', src: '메일 · 총무팀', body: 'CEO-MOON-MBP = 문태경 · DEV-KANG-02 = 강준혁 · DEV-HANSJ-03 = 한서진 · QA-HARIN-01 = 오하린 (10.0.4.17)' },
  admin:     { title: '빌려준 관리자 계정', src: '메일 · 강준혁', body: '강준혁은 배포 테스트용으로 자기 관리자 계정(kang.jh)을 QA팀 오하린에게 임시로 공유했다. MDM 콘솔 권한 포함.' },
  usb:       { t: '22:25', title: 'USB 연결', src: '이벤트 뷰어', body: '22:25, 서진이 SanDisk 32GB USB(E:)를 꽂았다.' },
  zip:       { t: '22:31', title: '암호 걸린 백업', src: '다운로드 폴더', body: '22:31, ledger_backup.zip이 생겼다. 암호 힌트: "제천 할머니 집 와이파이".' },
  pwhint:    { t: '22:44', title: '누나가 남긴 힌트', src: '링크톡 · 우리 가족', body: '서진: "도윤아 혹시 나중에 내가 뭐 보내면, 비번은 제천 할머니 집 와이파이야."' },
  alibi:     { t: '22:50', title: '강준혁의 알리바이', src: '링크톡 · 개발팀', body: '22:50, 강준혁은 부산행 KTX 안이며 노트북을 회사에 두고 왔다고 했다.' },
  perm:      { t: '23:00', title: '회수된 권한', src: '메일 · 이벤트 뷰어', body: '23:00, 서진의 예치금DB 읽기 권한이 제거됐다. 변경한 사람: moon.tk (문태경).' },
  unrevoked: { t: '23:12', title: '아직 회수되지 않은 계정', src: '링크톡 · 개발팀', body: '23:10, 문태경이 "QA팀에 공유한 관리자 계정 회수했냐"고 묻는다. 강준혁: "아직이요."' },
  pw:        { t: '23:15', title: '비밀번호: jecheon0807', src: '링크톡 · 우리 가족', body: '23:15, 엄마가 알려준 제천 집 와이파이. 할아버지 생신(8월 7일)으로 만든 비밀번호.' },
  deleted:   { t: '23:41', title: '2분 만에 지워진 메시지', src: '링크톡 · 오하린', body: '하린 → (대표님에게 보내려던 것) "서진이 눈치챘어요. USB에 백업까지 떠놨어요. 자정 전에 제가 준혁 팀장님 계정으로 원격 초기화 걸게요."' },
  decoy:     { t: '23:46', title: '강릉으로 간다는 말', src: '링크톡 · 오하린', body: '23:46, 서진이 하린에게 "오늘 밤 강릉 내려간다"고 말했다. 하린의 메시지를 본 직후다.' },
  taxi:      { t: '23:47', title: '강릉역 택시 예약', src: '메일 · 바로콜', body: '23:47, 판교 → 강릉역 택시 예약 확정 (00:10 픽업).' },
  secret:    { t: '23:50', title: '"비밀기지 기억하지?"', src: '링크톡 · 우리 가족', body: '23:50, 서진이 가족방에: "도윤아 비밀기지 기억하지? 미안해. 엄마한테는 아직 말하지 마." 읽지 않음 1.' },
  mdmmail:   { t: '23:55', title: '원격 초기화 승인', src: '메일 · MDM', body: '23:55, MDM 알림: 이 PC의 원격 초기화를 승인한 계정은 kang.jh (강준혁).' },
  mdmlog:    { t: '23:55', title: '명령을 보낸 기기', src: '이벤트 뷰어', body: '23:55, WIPE 명령의 발신 기기는 QA-HARIN-01 (10.0.4.17).' },
  ledger:    { title: '송금 내역', src: 'ledger_backup.zip', body: '고객 예치금 4억 2천만 원이 일곱 번에 걸쳐 에버그린 홀딩스로 나갔다. 일곱 건 모두 승인자는 moon.tk.' },
  letter:    { title: '도윤에게', src: 'ledger_backup.zip', body: '"사람들이 날 찾는 곳엔 없을 거야. 어디로 간다고 말하든 믿지 마. 사다리 치우면 아무도 못 올라오는 데, 거기 있을게."' },
  photo:     { title: '우리 비밀기지', src: '사진 폴더', body: '2009년 여름. 제천 할머니 집 창고 위 다락. 사다리를 치우면 아무도 못 올라오는 곳.' },
};

// 막혔을 때 힌트 (아직 못 찾은 단서 순서대로)
const HINTS = [
  ['memo', '바탕화면의 COLD_BOOT_메모.txt부터 열어 보세요. 이 PC가 무엇인지 알 수 있습니다.'],
  ['diary', '파일 탐색기 → 문서 폴더에 서진의 업무일지가 있습니다.'],
  ['zip', '22:31쯤 다운로드 폴더에 새 파일이 생깁니다.'],
  ['pw', '가족 단톡방은 23시가 넘어서도 대화가 이어집니다.'],
  ['ledger', '비밀번호를 알았다면, 다음 회차에서는 22:31 직후 바로 압축을 풀 수 있습니다.'],
  ['assets', '받은편지함의 오래된 공지도 읽어 보세요. 기기 이름의 주인이 적혀 있습니다.'],
  ['deleted', '23:39쯤 하린이 무언가를 입력하기 시작합니다. 그 대화창을 미리 열어 두세요. 2분 뒤에는 사라집니다.'],
  ['mdmlog', '23:55에 이벤트 뷰어가 열려 있어야 볼 수 있는 기록이 있습니다. 23:58이 지나면 손쓸 수 없습니다.'],
  ['photo', '사진 폴더에 서진과 도윤의 어린 시절이 있습니다.'],
];

const REPORT = [
  { id: 'q1', q: '23:58, 서진의 PC를 원격 초기화한 사람은?', answer: 'harin',
    opts: [['kang', '강준혁 — 개발팀장, 계정 주인'], ['harin', '오하린 — QA, 서진의 친구'], ['moon', '문태경 — 대표'], ['seojin', '한서진 — 자작극']] },
  { id: 'q2', q: '그 일을 시킨 사람은?', answer: 'moon',
    opts: [['moon', '문태경 — 대표'], ['kang', '강준혁 — 개발팀장'], ['harin', '오하린 — 스스로 결정'], ['hacker', '외부 해커']] },
  { id: 'q3', q: '서진은 지금 어디에 있는가?', answer: 'jecheon',
    opts: [['gangneung', '강릉역 근처'], ['jecheon', '제천 할머니 집 창고 다락'], ['harin', '오하린의 집'], ['office', '페이로드 사무실 서버실']] },
];

// 메신저 대화방과 22:00 이전 기록
const CHATS = [
  {
    id: 'harin', title: '오하린', who: 'harin',
    history: [
      { day: '11월 19일 목요일', time: '19:02', who: 'harin', text: '내일 회식 올 거지? 대표님이 쏘신대 🍖' },
      { day: '11월 19일 목요일', time: '19:10', who: 'seojin', text: '봐서~ 요즘 정산 때문에 정신없어' },
      { day: TODAY, time: '18:40', who: 'harin', text: '서진아 진짜 안 와? 니 자리 맡아놨는데' },
      { day: TODAY, time: '18:52', who: 'seojin', text: '미안 ㅠ 오늘은 패스. 확인할 게 있어' },
      { day: TODAY, time: '18:53', who: 'harin', text: '또 일이야? 몸 좀 챙겨라 진짜' },
    ],
  },
  {
    id: 'family', title: '우리 가족', count: 3, group: ['mom', 'doyun'],
    history: [
      { day: '11월 18일 수요일', time: '08:12', who: 'mom', text: '얘들아 29일 할아버지 제사다. 시간 비워놔라' },
      { day: '11월 18일 수요일', time: '08:30', who: 'doyun', text: '넵' },
      { day: '11월 18일 수요일', time: '09:02', who: 'seojin', text: '응 엄마' },
      { day: '11월 18일 수요일', time: '09:05', who: 'mom', text: '서진이 밥은 먹고 다니냐' },
    ],
  },
  {
    id: 'team', title: '페이로드 개발팀', count: 6, group: ['kang', 'moon'],
    history: [
      { day: TODAY, time: '17:55', who: 'kang', text: '이번 주 금요일 배포 없습니다. 다들 주말 잘 보내세요' },
      { day: TODAY, time: '18:02', who: 'moon', text: '다들 한 주 고생 많았어요. 회식 7시 강남역 3번 출구' },
      { day: TODAY, time: '18:03', who: 'harin', text: '넵 대표님!' },
    ],
  },
];

// 22:00 스냅샷에 있던 메일 (최신순)
const MAILS0 = [
  {
    id: 'ceo', from: '문태경', addr: 'tk.moon@payroad.kr', to: '페이로드 전체', date: '17:40', full: '2026-11-20 (금) 17:40',
    subject: '[공지] 11월 정산 마감 및 예치금 계정 운영 안내',
    body: `<p>11월 정산 마감 주간입니다.</p>
      <p>예치금 계정(<code>ledger_prod</code>)은 재무팀과 대표 승인 하에서만 운영됩니다. 개인적으로 조회하거나 추출하는 일이 없도록 해 주세요. 보안 감사 대상입니다.</p>
      <p class="sig">문태경 · 대표이사</p>`,
  },
  {
    id: 'admin', from: '강준혁', addr: 'jh.kang@payroad.kr', to: '개발팀, QA팀', date: '09:12', full: '2026-11-20 (금) 09:12', clue: 'admin', read: true,
    subject: '[공지] 배포 테스트용 관리자 계정 임시 공유',
    body: `<p>QA팀 오하린 님께 배포 테스트용으로 제 관리자 계정(<code>kang.jh</code>)을 임시 공유했습니다.</p>
      <p>MDM 콘솔 접근 권한이 포함되어 있으니 테스트 외 용도로는 쓰지 말아 주세요. 테스트가 끝나는 대로 비밀번호를 바꾸겠습니다.</p>
      <p class="sig">강준혁 · 개발팀장</p>`,
  },
  {
    id: 'assets', from: '총무팀', addr: 'admin@payroad.kr', to: '페이로드 전체', date: '11.19', full: '2026-11-19 (목) 14:30', clue: 'assets', read: true,
    subject: '[자산] 업무용 PC 자산 목록 갱신 안내',
    body: `<p>안녕하세요, 총무팀입니다.<br>11월 기준 업무용 PC 자산 목록을 갱신했습니다. 기기 이름은 MDM 콘솔과 보안 로그에 그대로 표시됩니다.</p>
      <table class="mtable"><thead><tr><th>기기 이름</th><th>사용자</th><th>부서</th><th>IP</th></tr></thead><tbody>
      <tr><td>CEO-MOON-MBP</td><td>문태경</td><td>대표</td><td>10.0.1.2</td></tr>
      <tr><td>DEV-KANG-02</td><td>강준혁</td><td>개발</td><td>10.0.2.11</td></tr>
      <tr><td>DEV-HANSJ-03</td><td>한서진</td><td>개발</td><td>10.0.2.14</td></tr>
      <tr><td>QA-HARIN-01</td><td>오하린</td><td>QA</td><td>10.0.4.17</td></tr>
      <tr><td>FIN-PARK-01</td><td>박민정</td><td>재무</td><td>10.0.3.5</td></tr>
      </tbody></table>
      <p class="sig">페이로드 총무팀 · 내선 1004</p>`,
  },
  {
    id: 'coupon', from: '바로콜', addr: 'noreply@barocall.kr', to: '한서진', date: '11.17', full: '2026-11-17 (월) 10:00', read: true,
    subject: '[바로콜] 11월 심야 할증 할인 쿠폰이 도착했어요',
    body: `<p>서진 님, 늦은 귀가길도 바로콜과 함께하세요.</p><p><span class="tag">심야 20% 할인</span> 11월 30일까지 사용 가능</p>`,
  },
];

const LOGS0 = [
  { time: '21:12:03', lv: 'info', src: 'Kernel-Power', text: '시스템이 절전 모드에서 다시 시작되었습니다.' },
  { time: '21:12:09', lv: 'info', src: 'Netlogon', text: 'payroad.kr 도메인에 연결되었습니다 (VPN).' },
  { time: '21:47:55', lv: 'warn', src: 'Defender', text: '정의 업데이트를 건너뛰었습니다 — 회사 정책.' },
  { time: '21:59:58', lv: 'info', src: 'COLD_BOOT', text: '스냅샷 생성을 시작합니다.' },
  { time: '22:00:00', lv: 'info', src: 'COLD_BOOT', text: '스냅샷 생성 완료 · 통신 및 파일 변경 기록을 시작합니다.' },
];

const FILES0 = {
  desktop: [
    { name: 'COLD_BOOT_메모.txt', icon: 'txt', kind: 'doc', ref: 'memo', size: '1 KB', mod: '2026-11-02 01:14' },
  ],
  docs: [
    { name: '업무일지_11월.txt', icon: 'txt', kind: 'doc', ref: 'diary', size: '2 KB', mod: '2026-11-20 21:40' },
    { name: '이력서_한서진_2024.pdf', icon: 'pdf', kind: 'pdf', size: '412 KB', mod: '2024-03-11 23:02' },
  ],
  downloads: [
    { name: '바로콜_영수증_1103.pdf', icon: 'pdf', kind: 'pdf', size: '88 KB', mod: '2026-11-03 23:51' },
  ],
  photos: [
    { name: '2009_제천_할머니집.jpg', icon: 'img', kind: 'photo', ref: 'house', size: '1.2 MB', mod: '2009-07-26 15:22' },
    { name: '2009_비밀기지.jpg', icon: 'img', kind: 'photo', ref: 'attic', size: '0.9 MB', mod: '2009-07-26 16:05' },
    { name: '2021_강릉_워크숍.jpg', icon: 'img', kind: 'photo', ref: 'sea', size: '3.8 MB', mod: '2021-06-19 19:48' },
  ],
  trash: [
    { name: '하린_생일선물.txt', icon: 'txt', kind: 'doc', ref: 'gift', size: '1 KB', mod: '2026-11-12 00:31' },
  ],
};

const FOLDERS = [
  ['desktop', '바탕화면', 'folder'],
  ['docs', '문서', 'folder'],
  ['downloads', '다운로드', 'folder'],
  ['photos', '사진', 'folder'],
  ['trash', '휴지통', 'trash'],
];

const DOCS = {
  memo: { clue: 'memo', text:
`COLD_BOOT v0.3 — 개인용 메모

- 매일 22:00, 이 PC의 스냅샷을 뜬다.
- 22:00 이후의 통신(메신저, 메일)과 파일 변경, 시스템 로그를 전부 기록한다.
- 3일 동안 내가 로그인하지 않으면 이미지가 도윤이에게 자동으로 간다.
- 이미지를 켜면 그날 밤이 그대로 다시 재생된다.
  기록이 끝나는 지점에서 스냅샷으로 돌아간다. 몇 번이든.

도윤아, 이걸 보고 있다면 미안. 그리고 고마워.

재생은 바꿀 수 없어.
하지만 보는 건 몇 번이고 할 수 있어.
한 번에 다 보려고 하지 마.` },

  diary: { clue: 'diary', text:
`11/03  정산 배치 리팩터링 시작.
11/07  준혁 팀장님 휴가. 코드 리뷰 밀림.
11/14  예치금 테이블 합계가 고객 잔액 합계랑 안 맞는다.
       차이 420,000,000원. 반올림 문제 아님.
11/16  출금 로그에 "에버그린 홀딩스"라는 거래처.
       계약서도, 세금계산서도 없음. 승인자 확인 필요.
11/18  하린이한테 말할까 하다가 말았다.
       아직 확실하지 않으니까.
11/20  오늘 밤 원본 뽑아서 백업한다.
       비번은 도윤이만 알 수 있게.
       COLD_BOOT 켜 둠.` },

  gift: { text:
`하린 생일 12/3

- 향수 (뭐 좋아하는지 물어보기)
- 목도리
- 강릉 그 카페 원두   ← 이거다
  (워크숍 때 둘이 빠져나가서 갔던 데)` },

  letter: { clue: 'letter', text:
`도윤아.

이걸 열었다면 제천 집 와이파이를 기억해냈거나,
엄마한테 물어봤겠지.

같이 들어 있는 송금내역은 우리 회사 고객 돈이
어디로 갔는지 보여 줘. 원본은 USB에 있어.

혹시 내가 연락이 안 되면,
사람들이 날 찾는 곳엔 없을 거야.
어디로 간다고 말하든 믿지 마.
그건 남들 들으라고 하는 말이야.

우리 어릴 때 숨던 데 기억나?
사다리 치우면 아무도 못 올라오는 데.
거기 있을게.

- 누나가` },
};

const LEDGER = [
  ['2026-09-03', 48000000, '서버 유지보수'],
  ['2026-09-24', 72000000, '외주 개발비'],
  ['2026-10-08', 55000000, '보안 컨설팅'],
  ['2026-10-22', 60000000, '서버 유지보수'],
  ['2026-11-04', 65000000, '라이선스 갱신'],
  ['2026-11-12', 70000000, '외주 개발비'],
  ['2026-11-18', 50000000, '보안 컨설팅'],
];

// 22:00 이후 일어나는 일 (재생 기록)
const EVENTS = [
  // 링크톡 — 오하린
  { t: '22:06', type: 'msg', chat: 'harin', who: 'harin', text: '아직 일해? 다들 너 어디 갔냐고 물어보더라 ㅋㅋ' },
  { t: '22:08', type: 'msg', chat: 'harin', who: 'seojin', text: '응 확인할 게 좀 있어서' },
  { t: '22:18', type: 'msg', chat: 'harin', who: 'seojin', text: '하린아 너 QA 서버에서 예치금 테이블 본 적 있어?' },
  { t: '22:19', type: 'msg', chat: 'harin', who: 'harin', text: '아니? 그건 대표님이랑 재무팀만 볼 수 있잖아' },
  { t: '22:19', type: 'msg', chat: 'harin', who: 'harin', text: '왜??' },
  { t: '22:21', type: 'msg', chat: 'harin', who: 'seojin', text: '아냐 그냥. 숫자가 좀 이상해서' },
  { t: '22:22', type: 'msg', chat: 'harin', who: 'harin', text: '뭐가? 말해봐' },
  { t: '23:02', type: 'msg', chat: 'harin', who: 'harin', text: '서진아 답장 왜 안 해 ㅠ' },
  { t: '23:20', type: 'msg', chat: 'harin', who: 'harin', text: '너 오늘 진짜 이상해. 내가 너네 집 갈까?' },
  { t: '23:22', type: 'msg', chat: 'harin', who: 'seojin', text: '아니 괜찮아. 혹시 나한테 무슨 일 생기면 도윤이한테 연락 좀 해줘' },
  { t: '23:23', type: 'msg', chat: 'harin', who: 'harin', text: '무슨 소리야 무섭게 ㅠㅠ' },
  { t: '23:39', type: 'typing', chat: 'harin', who: 'harin', until: '23:41' },
  { t: '23:41', type: 'msg', chat: 'harin', who: 'harin', key: 'slip', clue: 'deleted', text: '대표님, 서진이 눈치챘어요. USB에 백업까지 떠놨어요. 자정 전에 제가 준혁 팀장님 계정으로 원격 초기화 걸게요.' },
  { t: '23:43', type: 'delete', chat: 'harin', key: 'slip' },
  { t: '23:44', type: 'msg', chat: 'harin', who: 'seojin', text: '하린아?' },
  { t: '23:44', type: 'msg', chat: 'harin', who: 'seojin', text: '방금 그거 뭐야' },
  { t: '23:45', type: 'msg', chat: 'harin', who: 'harin', text: '아 잘못 보냈어 ㅋㅋ 업무 얘기야 신경 쓰지 마' },
  { t: '23:46', type: 'msg', chat: 'harin', who: 'seojin', clue: 'decoy', text: '응 ㅎㅎ 나 오늘 밤에 강릉 내려가려고. 바다 보고 싶어서' },
  { t: '23:47', type: 'msg', chat: 'harin', who: 'harin', text: '갑자기? 조심히 가 ㅠ 도착하면 꼭 연락해' },

  // 링크톡 — 우리 가족
  { t: '22:40', type: 'msg', chat: 'family', who: 'mom', text: '서진아 29일 제사 오지? 할머니가 너 보고 싶어 하신다' },
  { t: '22:42', type: 'msg', chat: 'family', who: 'seojin', text: '응 엄마 갈게' },
  { t: '22:44', type: 'msg', chat: 'family', who: 'seojin', clue: 'pwhint', text: '도윤아 혹시 나중에 내가 뭐 보내면, 비번은 제천 할머니 집 와이파이야' },
  { t: '22:47', type: 'msg', chat: 'family', who: 'doyun', text: '갑자기? ㅋㅋ 그걸 어떻게 기억해' },
  { t: '22:48', type: 'msg', chat: 'family', who: 'seojin', text: '기억 안 나면 엄마한테 물어봐' },
  { t: '23:14', type: 'typing', chat: 'family', who: 'mom', until: '23:15' },
  { t: '23:15', type: 'msg', chat: 'family', who: 'mom', clue: 'pw', text: 'jecheon0807 이거 아니니? 할아버지 생신으로 했잖아' },
  { t: '23:15', type: 'msg', chat: 'family', who: 'mom', text: '근데 그건 왜?' },
  { t: '23:16', type: 'msg', chat: 'family', who: 'seojin', text: '그냥 ㅎㅎ 고마워 엄마. 잘 자' },
  { t: '23:50', type: 'msg', chat: 'family', who: 'seojin', clue: 'secret', unread: true, text: '도윤아 비밀기지 기억하지?' },
  { t: '23:50', type: 'msg', chat: 'family', who: 'seojin', unread: true, text: '미안해. 엄마한테는 아직 말하지 마' },

  // 링크톡 — 개발팀
  { t: '22:50', type: 'msg', chat: 'team', who: 'kang', clue: 'alibi', text: '저 지금 부산 내려가는 KTX인데 노트북을 회사에 두고 왔네요 ㅠ 월요일까지 급한 건 전화 주세요' },
  { t: '23:10', type: 'msg', chat: 'team', who: 'moon', text: '준혁 팀장, QA팀에 공유한 관리자 계정 회수했어요?' },
  { t: '23:12', type: 'msg', chat: 'team', who: 'kang', clue: 'unrevoked', text: '아 아직이요;; 월요일 출근하자마자 바꾸겠습니다' },
  { t: '23:13', type: 'msg', chat: 'team', who: 'moon', text: '알겠어요' },

  // 메일
  { t: '23:00', type: 'mail', mail: {
    id: 'perm', from: '페이로드 보안', addr: 'security@payroad.kr', to: '한서진', date: '23:00', full: '2026-11-20 (금) 23:00', clue: 'perm',
    subject: '[보안] 계정 권한이 변경되었습니다',
    body: `<p>회원님 계정의 권한이 관리자에 의해 변경되었습니다.</p>
      <dl class="kv"><dt>계정</dt><dd>han.seojin</dd><dt>변경 내용</dt><dd>예치금DB(<code>ledger_prod</code>) 읽기 권한 제거</dd><dt>변경자</dt><dd><b>moon.tk</b></dd><dt>시각</dt><dd>2026-11-20 23:00:04</dd></dl>
      <p class="sig">본인이 요청하지 않았다면 보안 담당자에게 문의하세요.</p>` } },
  { t: '23:47', type: 'mail', mail: {
    id: 'taxi', from: '바로콜', addr: 'noreply@barocall.kr', to: '한서진', date: '23:47', full: '2026-11-20 (금) 23:47', clue: 'taxi',
    subject: '[바로콜] 예약이 확정되었습니다',
    body: `<div class="receipt"><b>예약 확정</b><dl class="kv"><dt>픽업</dt><dd>11월 21일 00:10</dd><dt>출발</dt><dd>성남시 분당구 판교 (자택)</dd><dt>도착</dt><dd><b>강릉역</b></dd><dt>예상 요금</dt><dd>182,400원 (심야 할증)</dd></dl></div>
      <p class="sig">기사님이 배정되면 다시 알려 드릴게요.</p>` } },
  { t: '23:55', type: 'mail', mail: {
    id: 'mdm', from: '페이로드 MDM', addr: 'mdm@payroad.kr', to: '한서진', date: '23:55', full: '2026-11-20 (금) 23:55', clue: 'mdmmail',
    subject: '[MDM] 이 기기에 원격 초기화가 예약되었습니다',
    body: `<p><span class="tag red">되돌릴 수 없음</span></p>
      <dl class="kv"><dt>대상 기기</dt><dd>DEV-HANSJ-03 (한서진)</dd><dt>명령</dt><dd>WIPE — 전체 초기화</dd><dt>승인 계정</dt><dd><b>kang.jh</b></dd><dt>실행 예정</dt><dd>23:58</dd></dl>
      <p class="sig">이 메일은 발신 전용입니다.</p>` } },

  // 시스템 로그
  { t: '22:25', type: 'log', log: { time: '22:25:41', lv: 'warn', src: 'USB', clue: 'usb', text: '이동식 저장 장치 연결됨 — SanDisk Ultra 32GB (E:)' } },
  { t: '22:25', type: 'usb', on: true },
  { t: '22:29', type: 'log', log: { time: '22:29:12', lv: 'info', src: 'SQL Client', text: 'ledger_prod 조회 · withdrawals 테이블 412행 추출 (han.seojin)' } },
  { t: '22:31', type: 'log', log: { time: '22:31:07', lv: 'info', src: '파일 시스템', text: '새 파일: C:\\Users\\seojin\\Downloads\\ledger_backup.zip (AES-256)' } },
  { t: '22:31', type: 'file', dir: 'downloads', file: { name: 'ledger_backup.zip', icon: 'zip', kind: 'zip', size: '3.4 MB', mod: '2026-11-20 22:31' } },
  { t: '22:33', type: 'log', log: { time: '22:33:50', lv: 'info', src: '파일 시스템', text: '복사 완료: ledger_backup.zip → E:\\' } },
  { t: '23:00', type: 'log', log: { time: '23:00:04', lv: 'warn', src: '보안', clue: 'perm', text: '권한 변경: han.seojin · ledger_prod 읽기 권한 제거 · 요청 moon.tk' } },
  { t: '23:49', type: 'log', log: { time: '23:49:30', lv: 'info', src: 'USB', text: '이동식 저장 장치를 안전하게 제거했습니다 (E:).' } },
  { t: '23:49', type: 'usb', on: false },
  { t: '23:55', type: 'log', log: { time: '23:55:19', lv: 'crit', src: 'MDM', clue: 'mdmlog', text: '원격 명령 수신: WIPE · 계정 kang.jh · 발신 기기 QA-HARIN-01 (10.0.4.17)' } },
  { t: '23:58', type: 'log', log: { time: '23:58:12', lv: 'crit', src: 'MDM', text: '원격 초기화를 시작합니다. 모든 사용자 데이터가 삭제됩니다.' } },
  { t: '23:58', type: 'wipe' },
];
EVENTS.forEach(e => { e.m = tm(e.t); });
EVENTS.sort((a, b) => a.m - b.m);

const COUNT = {
  msg: EVENTS.filter(e => e.type === 'msg').length,
  mail: EVENTS.filter(e => e.type === 'mail').length,
  log: EVENTS.filter(e => e.type === 'log').length,
};

const BOOT_TIPS = [
  '창은 여러 개 띄울 수 있습니다. 하지만 모든 것을 동시에 볼 수는 없습니다.',
  '수사 노트를 여는 동안에는 재생이 멈춥니다. 아래 타임라인의 호박색 표시는 이미 알아낸 사건의 시각입니다.',
  '이전 회차에서 알아낸 것은 이번 회차에서 바로 쓸 수 있습니다. 비밀번호처럼.',
  '놓친 것은 기록에서 사라지지 않습니다. 다만 당신이 보지 않았을 뿐입니다.',
];


/* ---------------------------------------------------------
   3. 아이콘과 사진
   --------------------------------------------------------- */

const SHINE = '<rect x="4.5" y="4.5" width="39" height="39" rx="10.5" fill="none" stroke="#fff" stroke-opacity=".28"/>';
const PAGE = (fill, extra) =>
  `<path d="M12 4h16.5L38 13.5V41a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="${fill}"/>` +
  '<path d="M28.5 4v7.5a2 2 0 0 0 2 2H38z" fill="#000" fill-opacity=".16"/>' + extra;

const ICONS = {
  chat: '<rect x="4" y="4" width="40" height="40" rx="11" fill="url(#g-chat)"/>' + SHINE +
    '<path d="M14 13h20a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H25l-7.5 6v-6H14a5 5 0 0 1-5-5v-9a5 5 0 0 1 5-5z" fill="#fff"/>' +
    '<circle cx="18" cy="22.5" r="2.2" fill="#1b8296"/><circle cx="24" cy="22.5" r="2.2" fill="#1b8296"/><circle cx="30" cy="22.5" r="2.2" fill="#1b8296"/>',
  mail: '<rect x="4" y="4" width="40" height="40" rx="11" fill="url(#g-mail)"/>' + SHINE +
    '<rect x="10" y="14" width="28" height="20" rx="3.5" fill="#fff"/>' +
    '<path d="M11.5 16.5 24 25.5l12.5-9" fill="none" stroke="#3550cc" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  folder: '<path d="M5 12a4 4 0 0 1 4-4h9.5l4 4H39a4 4 0 0 1 4 4v3H5z" fill="#c07d22"/>' +
    '<path d="M5 18a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v19a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="url(#g-folder)"/>' +
    '<path d="M8.5 18.5h31" stroke="#fff" stroke-opacity=".6" stroke-linecap="round"/>',
  log: '<rect x="4" y="4" width="40" height="40" rx="11" fill="url(#g-log)"/>' + SHINE +
    '<rect x="11" y="13" width="4" height="4" rx="1" fill="#45d49a"/><rect x="18" y="13.5" width="19" height="3" rx="1.5" fill="#c9d3ea"/>' +
    '<rect x="11" y="21" width="4" height="4" rx="1" fill="#f2b45a"/><rect x="18" y="21.5" width="15" height="3" rx="1.5" fill="#c9d3ea" opacity=".8"/>' +
    '<rect x="11" y="29" width="4" height="4" rx="1" fill="#ff4d5e"/><rect x="18" y="29.5" width="17" height="3" rx="1.5" fill="#c9d3ea" opacity=".6"/>',
  txt: PAGE('url(#g-txt)', '<g fill="#8a93a8"><rect x="14" y="20" width="18" height="2" rx="1"/><rect x="14" y="25" width="19" height="2" rx="1"/><rect x="14" y="30" width="14" height="2" rx="1"/><rect x="14" y="35" width="17" height="2" rx="1"/></g>'),
  pdf: PAGE('url(#g-txt)', '<rect x="8" y="25" width="23" height="12" rx="2.5" fill="url(#g-pdf)"/><text x="19.5" y="34" text-anchor="middle" font-size="8" font-weight="700" fill="#fff" font-family="sans-serif">PDF</text>'),
  zip: PAGE('url(#g-zip)', '<g fill="#fff" fill-opacity=".85"><rect x="20" y="5" width="4" height="3"/><rect x="24" y="8" width="4" height="3"/><rect x="20" y="11" width="4" height="3"/><rect x="24" y="14" width="4" height="3"/><rect x="20" y="17" width="4" height="3"/></g><rect x="19" y="22" width="10" height="12" rx="2" fill="#fff"/><rect x="22" y="27" width="4" height="4" rx="1" fill="#6d48d8"/>'),
  img: '<rect x="5" y="8" width="38" height="32" rx="5" fill="url(#g-img)"/><circle cx="16" cy="18" r="4" fill="#fff4c0"/>' +
    '<path d="M5 33 17 23l8 8 6-5 12 9v0a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" fill="#1f4f9a"/>' +
    '<rect x="5.5" y="8.5" width="37" height="31" rx="4.5" fill="none" stroke="#fff" stroke-opacity=".35"/>',
  csv: PAGE('url(#g-csv)', '<g stroke="#fff" stroke-opacity=".85" stroke-width="1.4"><path d="M13 20h20M13 26h20M13 32h20M13 38h20M20 17v23M27 17v23"/></g>'),
  trash: '<path d="M13 15h22l-2 25a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z" fill="url(#g-trash)"/><rect x="10" y="10" width="28" height="5" rx="2.5" fill="#e6ebf5"/>' +
    '<rect x="20" y="6.5" width="8" height="4" rx="1.5" fill="#e6ebf5"/><g stroke="#5f6983" stroke-width="1.6" stroke-linecap="round"><path d="M20 20v17M24 20v17M28 20v17"/></g>',
  usb: '<rect x="17" y="4" width="14" height="10" rx="1.5" fill="#cfd6e6"/><rect x="20" y="7" width="3" height="3" fill="#4d5670"/><rect x="25" y="7" width="3" height="3" fill="#4d5670"/>' +
    '<rect x="13" y="13" width="22" height="31" rx="5" fill="url(#g-usb)"/><circle cx="24" cy="36" r="2.2" fill="#45d49a"/>',
  lock: '<path d="M16 21v-5a8 8 0 0 1 16 0v5" fill="none" stroke="#cfd6e6" stroke-width="4"/><rect x="10" y="20" width="28" height="23" rx="5" fill="url(#g-zip)"/>' +
    '<circle cx="24" cy="30" r="3.2" fill="#fff"/><rect x="23" y="31" width="2" height="6.5" rx="1" fill="#fff"/>',
  notes: '<rect x="9" y="5" width="30" height="38" rx="4" fill="url(#g-notes)"/><rect x="9" y="5" width="7" height="38" rx="3" fill="#000" fill-opacity=".2"/>' +
    '<g fill="#5a3a10" fill-opacity=".6"><rect x="20" y="14" width="14" height="2.6" rx="1.3"/><rect x="20" y="20" width="11" height="2.6" rx="1.3"/><rect x="20" y="26" width="13" height="2.6" rx="1.3"/></g>',
  info: '<circle cx="24" cy="24" r="18" fill="url(#g-mail)"/><rect x="22" y="21" width="4" height="13" rx="2" fill="#fff"/><circle cx="24" cy="15.5" r="2.5" fill="#fff"/>',
};

function icon(name, size = 40) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${ICONS[name] || ICONS.txt}</svg>`;
}

const SVG_MIN = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" stroke-width="1.2"/></svg>';
const SVG_X = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1 1 9" stroke="currentColor" stroke-width="1.2"/></svg>';
const SVG_WARN = '<svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 22.4 20.5H1.6z" fill="#ff4d5e"/><rect x="11" y="9" width="2" height="6.5" rx="1" fill="#2a0006"/><circle cx="12" cy="18" r="1.3" fill="#2a0006"/></svg>';

// 사진 (SVG로 그린 그림)
const STAMP = (txt) => `<text x="606" y="396" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="21" font-weight="700" fill="#ff8a2a" opacity=".92" style="paint-order:stroke" stroke="#ff8a2a" stroke-opacity=".25" stroke-width="4">${txt}</text>`;
const VIGNETTE = id => `<radialGradient id="${id}" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>`;

const PHOTOS = (() => {
  // 실제 사진 위에 디카 날짜 각인과 빨간 동그라미를 덧씌움
  // 사진을 못 불러오면 원래 SVG 그림(fallback)을 대신 보여 줌
  const pic = ({ src, alt, stamp, mark, fallback }) => `
    <div style="position:relative;width:100%;height:100%;background:#000">
      <img src="${src}" alt="${alt}" style="display:block;width:100%;height:100%;object-fit:cover"
           onerror="this.parentNode.innerHTML=this.parentNode.querySelector('template').innerHTML">
      ${mark ? `<i style="position:absolute;left:${mark.x};top:${mark.y};width:${mark.w};height:${mark.h};border:3px solid rgba(255,59,59,.85);border-radius:50%;transform:rotate(-8deg)"></i>` : ''}
      ${stamp ? `<span style="position:absolute;right:4%;bottom:5%;font:700 20px var(--mono);color:#ff8a2a;text-shadow:0 0 6px rgba(255,138,42,.6);letter-spacing:.04em">${stamp}</span>` : ''}
      <template>${fallback}</template>
    </div>`;

  const SVG_HOUSE = `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ph-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fa9d8"/><stop offset=".75" stop-color="#d8e8d6"/></linearGradient>
        <linearGradient id="ph-yard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4bf93"/><stop offset="1" stop-color="#b79c6c"/></linearGradient>
        ${VIGNETTE('ph-vig')}
      </defs>
      <rect width="640" height="420" fill="url(#ph-sky)"/>
      <g fill="#fff" opacity=".75"><ellipse cx="130" cy="64" rx="74" ry="16"/><ellipse cx="178" cy="54" rx="40" ry="14"/><ellipse cx="470" cy="90" rx="60" ry="12"/></g>
      <path d="M0 246C70 168 130 186 186 214 248 158 304 150 362 198 424 166 500 136 560 186 600 172 620 182 640 192V420H0Z" fill="#82a983"/>
      <path d="M0 272C90 230 160 248 240 262 330 230 420 238 520 254 580 246 620 250 640 254V420H0Z" fill="#5c8a61"/>
      <rect y="300" width="640" height="120" fill="url(#ph-yard)"/>
      <path d="M0 300H640" stroke="#a88f60" stroke-width="2"/>
      <g fill="#6b4529"><ellipse cx="44" cy="330" rx="20" ry="9"/><ellipse cx="80" cy="336" rx="16" ry="8"/><ellipse cx="62" cy="352" rx="22" ry="10"/></g>
      <g fill="#8a5a35"><path d="M26 330q18-30 36 0z"/><path d="M66 336q14-24 28 0z"/><path d="M42 352q20-34 40 0z"/></g>
      <path d="M58 312C60 272 54 252 70 222" stroke="#5a3d26" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M66 240C84 232 96 226 112 214" stroke="#5a3d26" stroke-width="6" fill="none" stroke-linecap="round"/>
      <g fill="#4d7a45"><circle cx="70" cy="200" r="40"/><circle cx="112" cy="206" r="30"/><circle cx="36" cy="214" r="26"/></g>
      <g fill="#5f904f"><circle cx="84" cy="188" r="26"/><circle cx="50" cy="196" r="20"/></g>
      <g fill="#ff8c2a"><circle cx="58" cy="210" r="4.5"/><circle cx="94" cy="196" r="4.5"/><circle cx="112" cy="220" r="4.5"/><circle cx="74" cy="226" r="4"/><circle cx="40" cy="224" r="4"/><circle cx="102" cy="178" r="4"/></g>
      <rect x="128" y="232" width="250" height="70" fill="#efe4cc"/>
      <g fill="#6b4a2f"><rect x="128" y="232" width="7" height="70"/><rect x="190" y="232" width="7" height="70"/><rect x="252" y="232" width="7" height="70"/><rect x="314" y="232" width="7" height="70"/><rect x="371" y="232" width="7" height="70"/></g>
      <g fill="#dccba7" stroke="#6b4a2f" stroke-width="2"><rect x="200" y="248" width="48" height="40"/><rect x="262" y="248" width="48" height="40"/></g>
      <g stroke="#6b4a2f" stroke-width="1.2"><path d="M224 248v40M200 268h48M286 248v40M262 268h48"/></g>
      <rect x="118" y="300" width="270" height="11" fill="#8d8371"/>
      <path d="M92 238Q106 226 126 222H380Q400 226 414 238L402 200Q253 182 104 200Z" fill="#3f4753"/>
      <g stroke="#2a3038" stroke-width="2" fill="none"><path d="M108 210Q253 192 398 210"/><path d="M100 224Q253 206 406 224"/></g>
      <path d="M150 196Q253 178 356 196L348 186Q253 170 158 186Z" fill="#2a3038"/>
      <rect x="436" y="216" width="120" height="88" fill="#a97f52"/>
      <g stroke="#8a6440" stroke-width="2"><path d="M456 216v88M476 216v88M516 216v88M536 216v88"/></g>
      <path d="M424 222 496 176 568 222Z" fill="#5b4a3d"/>
      <path d="M424 222 496 176 568 222" fill="none" stroke="#463a30" stroke-width="3"/>
      <rect x="484" y="196" width="24" height="16" fill="#25190f" stroke="#ecdfc3" stroke-width="2"/>
      <rect x="474" y="250" width="40" height="54" fill="#6b4a2f"/>
      <path d="M470 186C500 176 528 190 524 206 520 222 482 224 468 210 458 198 470 188 486 186" fill="none" stroke="#ff3b3b" stroke-width="3.4" stroke-linecap="round" opacity=".85"/>
      <g><circle cx="404" cy="290" r="7" fill="#2b1d16"/><path d="M396 298h16l4 22h-24z" fill="#e85d75"/><rect x="398" y="320" width="4" height="10" fill="#f0c7a3"/><rect x="406" y="320" width="4" height="10" fill="#f0c7a3"/></g>
      <g><circle cx="424" cy="298" r="6" fill="#2b1d16"/><rect x="418" y="305" width="12" height="15" rx="2" fill="#3d7dd6"/><rect x="419" y="320" width="4" height="10" fill="#2b3a55"/><rect x="425" y="320" width="4" height="10" fill="#2b3a55"/></g>
      <rect width="640" height="420" fill="#ffb060" opacity=".08"/>
      <rect width="640" height="420" fill="url(#ph-vig)"/>
      ${STAMP("'09 7 26")}
    </svg>`;
  const SVG_ATTIC = `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pa-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".34"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></linearGradient>
        <radialGradient id="pa-win" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff6d6"/><stop offset="1" stop-color="#ffd27a"/></radialGradient>
        ${VIGNETTE('pa-vig')}
      </defs>
      <rect width="640" height="420" fill="#24170e"/>
      <polygon points="0,0 320,92 110,420 0,420" fill="#3a2718"/>
      <polygon points="640,0 320,92 530,420 640,420" fill="#33221a"/>
      <polygon points="110,420 320,92 530,420" fill="#4b3322"/>
      <g stroke="#1c120a" stroke-width="10" stroke-linecap="round"><path d="M320 92 30 420M320 92 610 420M320 92 0 160M320 92 640 160"/></g>
      <g stroke="#5e412b" stroke-width="2" opacity=".6"><path d="M160 420 320 120M480 420 320 120M240 420 320 160M400 420 320 160"/></g>
      <rect x="292" y="196" width="56" height="42" rx="2" fill="url(#pa-win)"/>
      <path d="M320 196v42M292 217h56" stroke="#6b4a2f" stroke-width="4"/>
      <rect x="292" y="196" width="56" height="42" fill="none" stroke="#6b4a2f" stroke-width="5"/>
      <polygon points="292,238 348,238 470,420 200,420" fill="url(#pa-beam)"/>
      <g fill="#fff2c8" opacity=".7"><circle cx="300" cy="280" r="1.6"/><circle cx="336" cy="300" r="1.2"/><circle cx="318" cy="330" r="1.8"/><circle cx="352" cy="352" r="1.2"/><circle cx="286" cy="316" r="1"/><circle cx="372" cy="270" r="1.3"/></g>
      <rect y="356" width="640" height="64" fill="#5a3d26"/>
      <g stroke="#3e2919" stroke-width="2"><path d="M0 372H640M0 392H640M0 410H640"/></g>
      <rect x="134" y="330" width="190" height="52" rx="22" fill="#b84a47"/>
      <g stroke="#e8b3a0" stroke-width="3" opacity=".7"><path d="M150 346h158M150 362h158"/></g>
      <rect x="150" y="318" width="60" height="26" rx="12" fill="#e9e1cf"/>
      <g><rect x="410" y="348" width="64" height="10" fill="#3f7fe0"/><rect x="414" y="338" width="58" height="10" fill="#e85d75"/><rect x="408" y="328" width="62" height="10" fill="#f2c46a"/><rect x="412" y="318" width="56" height="10" fill="#45d49a"/></g>
      <g transform="rotate(-18 506 352)"><rect x="486" y="346" width="40" height="12" rx="4" fill="#2d3446"/><rect x="524" y="343" width="9" height="18" rx="2" fill="#4f5a78"/></g>
      <g transform="rotate(-4 420 150)">
        <rect x="372" y="118" width="120" height="74" fill="#f3ecd8"/>
        <rect x="372" y="118" width="120" height="74" fill="none" stroke="#d8ccb0"/>
        <text x="432" y="152" text-anchor="middle" font-size="22" font-weight="900" fill="#d23b3b" font-family="Noto Sans KR, sans-serif">비밀기지</text>
        <text x="432" y="176" text-anchor="middle" font-size="11" font-weight="700" fill="#3d7dd6" font-family="Noto Sans KR, sans-serif">서진·도윤 외 출입금지</text>
        <circle cx="432" cy="122" r="3" fill="#888"/>
      </g>
      <rect width="640" height="420" fill="#ff9040" opacity=".07"/>
      <rect width="640" height="420" fill="url(#pa-vig)"/>
      ${STAMP("'09 7 26")}
    </svg>`;
  const SVG_SEA = `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ps-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2f6e"/><stop offset=".45" stop-color="#a5618f"/><stop offset=".72" stop-color="#f5a77d"/></linearGradient>
        <linearGradient id="ps-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5f9c"/><stop offset="1" stop-color="#1f2350"/></linearGradient>
        <linearGradient id="ps-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79f7d"/><stop offset="1" stop-color="#7a5a48"/></linearGradient>
        <radialGradient id="ps-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1c9"/><stop offset=".45" stop-color="#ffd08a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a6a" stop-opacity="0"/></radialGradient>
        ${VIGNETTE('ps-vig')}
      </defs>
      <rect width="640" height="420" fill="url(#ps-sky)"/>
      <circle cx="410" cy="252" r="90" fill="url(#ps-sun)"/>
      <circle cx="410" cy="252" r="26" fill="#fff0c8"/>
      <rect y="258" width="640" height="100" fill="url(#ps-sea)"/>
      <g stroke="#ffd9a0" stroke-linecap="round" opacity=".75"><path d="M380 270h60M390 282h40M372 294h74M396 306h28M386 320h46" stroke-width="3"/></g>
      <g stroke="#b9bde8" stroke-width="1.5" opacity=".35" fill="none"><path d="M0 300q40-6 80 0t80 0 80 0"/><path d="M200 330q40-6 80 0t80 0 80 0"/><path d="M460 312q40-6 80 0t80 0"/></g>
      <path d="M520 262h120v12H520z" fill="#2a2440"/>
      <rect x="586" y="206" width="18" height="58" fill="#d6453f"/><rect x="583" y="200" width="24" height="8" fill="#f3ecd8"/><rect x="589" y="190" width="12" height="12" fill="#ffe7a8"/><path d="M586 190h18l-9-9z" fill="#d6453f"/>
      <path d="M0 352Q160 336 320 348T640 344V420H0Z" fill="url(#ps-sand)"/>
      <g fill="#2a2440"><circle cx="230" cy="324" r="8"/><path d="M220 332q10-4 20 0l4 22h-28z"/><circle cx="256" cy="326" r="7.5"/><path d="M247 333q9-4 18 0l4 21h-26z"/></g>
      <rect width="640" height="420" fill="url(#ps-vig)"/>
    </svg>`;

  return {
    house: {
      clue: 'photo', date: '2009-07-26 15:22 · DSC-W80',
      desc: '여름방학, 제천 할머니 집. 오른쪽 창고 위 다락이 우리 비밀기지. (빨간 동그라미는 2019년에 내가 그린 거)',
      svg: pic({
        src: 'photo/2009_제천_할머니집.jpg',
        alt: '제천 할머니 집',
        mark: { x: '81.5%', y: '9%', w: '11%', h: '17%' },   // 창고 위 다락 창문
        fallback: SVG_HOUSE,
      }),
    },
    attic: {
      clue: 'photo', date: '2009-07-26 16:05 · DSC-W80',
      desc: '사다리 치우면 아무도 못 올라옴. 도윤이 처음엔 엄청 무서워했음 ㅋㅋ',
      svg: pic({
        src: 'photo/2009_비밀기지.jpg',
        alt: '다락 비밀기지',
        fallback: SVG_ATTIC,
      }),
    },
    sea: {
clue: null, date: '2021-06-19 19:48 · 필름 카메라 앱',
      desc: '회사 워크숍, 강릉. 하린이랑 처음 제대로 얘기한 날. 둘이 빠져나와서 해 지는 거 봤다.',
      svg: pic({
        src: 'photo/2021_강릉_워크숍.jpg',
        alt: '강릉 바다',
        fallback: SVG_SEA,
      }),
    },
  };
})();


/* ---------------------------------------------------------
   4. 상태와 저장
   --------------------------------------------------------- */

function defaultSave() {
  return { loop: 1, clues: {}, intro: false, solved: false, reports: 0, memo: '', answers: {} };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? Object.assign(defaultSave(), JSON.parse(raw)) : defaultSave();
  } catch (e) {
    return defaultSave();
  }
}

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 저장 불가 환경: 무시 */ }
}

// 회차마다 처음으로 돌아가는 가상 PC 상태
function freshVM() {
  const msgs = {};
  CHATS.forEach(c => { msgs[c.id] = c.history.map(m => ({ ...m })); });
  return {
    t: 0,
    ev: 0,
    msgs,
    unread: { harin: 0, family: 0, team: 0 },
    typing: {},
    mails: MAILS0.map(m => ({ ...m })),
    mailRead: new Set(MAILS0.filter(m => m.read).map(m => m.id)),
    logs: LOGS0.map(l => ({ ...l })),
    files: JSON.parse(JSON.stringify(FILES0)),
    usb: false,
    unlocked: false,
    wiping: false,
    wipeN: 0,
  };
}

let save = loadSave();
let vm = freshVM();
let speed = 1;
let running = false;
let paused = false;
let transitioning = false;
let lastFrame = performance.now();
let lastMinute = -1;
let notesOpen = false;
let notesTab = 'timeline';
let resetArmed = false;
const newClues = new Set();

const stage = $('#stage');


/* ---------------------------------------------------------
   5. 화면 크기 맞추기 (1280×760 화면을 창 크기에 맞춰 확대·축소)
   --------------------------------------------------------- */

let scale = 1;

function fit() {
  scale = Math.min(innerWidth / W, innerHeight / H);
  const x = (innerWidth - W * scale) / 2;
  const y = (innerHeight - H * scale) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}


/* ---------------------------------------------------------
   6. 창 관리
   --------------------------------------------------------- */

const APPS = {
  messenger: { title: '링크톡', icon: 'chat', w: 740, h: 520, x: 120, y: 46, data: { chat: 'harin' }, render: renderMessenger },
  mail:      { title: '메일', icon: 'mail', w: 800, h: 520, x: 200, y: 70, data: { sel: null }, render: renderMail },
  explorer:  { title: '파일 탐색기', icon: 'folder', w: 720, h: 460, x: 260, y: 100, data: { dir: 'docs' }, render: renderExplorer },
  events:    { title: '이벤트 뷰어', icon: 'log', w: 840, h: 420, x: 180, y: 150, render: renderEvents },
  doc:       { title: '메모장', icon: 'txt', w: 540, h: 470, x: 400, y: 60, render: renderDoc },
  photo:     { title: '사진', icon: 'img', w: 680, h: 550, x: 330, y: 40, render: renderPhoto },
  zip:       { title: 'ledger_backup.zip', icon: 'zip', w: 480, h: 390, x: 420, y: 140, render: renderZip },
  csv:       { title: '송금내역_요약.csv', icon: 'csv', w: 780, h: 430, x: 250, y: 110, render: renderCsv },
  dialog:    { title: '알림', icon: 'info', w: 380, h: 210, x: 450, y: 250, render: renderDialog },
};

const wins = new Map();
let zTop = 10;
let focusedId = null;

function openApp(app, opt = {}) {
  const id = opt.id || app;

  // 이미 열려 있으면 앞으로 가져오기
  if (wins.has(id)) {
    const w = wins.get(id);
    Object.assign(w.data, opt.data || {});
    if (w.min) { w.min = false; w.el.classList.remove('min'); }
    focusWin(w);
    renderWin(w);
    return w;
  }

  const def = APPS[app];
  const n = wins.size;
  const ww = opt.w || def.w;
  const hh = opt.h || def.h;
  const x = clamp((opt.x ?? def.x) + (n % 5) * 26, 8, W - ww - 8);
  const y = clamp((opt.y ?? def.y) + (n % 5) * 22, 8, H - TASKBAR - hh - 8);

  const el = document.createElement('section');
  el.className = 'win';
  el.dataset.id = id;
  el.style.cssText = `left:${x}px;top:${y}px;width:${ww}px;height:${hh}px`;
  const title = opt.title || def.title;
  const ic = opt.icon || def.icon;
  el.innerHTML = `
    <header class="titlebar">
      <span class="tb-ic">${icon(ic, 16)}</span>
      <span class="tb-title">${esc(title)}</span>
      <button class="wbtn" data-a="win-min" aria-label="최소화">${SVG_MIN}</button>
      <button class="wbtn close" data-a="win-close" aria-label="닫기">${SVG_X}</button>
    </header>
    <div class="wbody"></div>`;
  $('#windows').appendChild(el);

  const w = { id, app, el, body: $('.wbody', el), title, icon: ic, min: false, data: { ...(def.data || {}), ...(opt.data || {}) } };
  wins.set(id, w);
  focusWin(w);
  renderWin(w);
  return w;
}

function focusWin(w) {
  if (!w) return;
  zTop += 1;
  w.el.style.zIndex = zTop;
  focusedId = w.id;
  wins.forEach(x => x.el.classList.toggle('focus', x === w));
  renderTaskbar();
}

function topVisible() {
  let best = null;
  wins.forEach(w => {
    if (!w.min && (!best || +w.el.style.zIndex > +best.el.style.zIndex)) best = w;
  });
  return best;
}

function minimizeWin(w) {
  w.min = true;
  w.el.classList.add('min');
  focusedId = null;
  const next = topVisible();
  if (next) focusWin(next); else renderTaskbar();
}

function closeWin(w) {
  wins.delete(w.id);
  w.el.classList.add('closing');
  setTimeout(() => w.el.remove(), 140);
  if (focusedId === w.id) {
    focusedId = null;
    const next = topVisible();
    if (next) focusWin(next);
  }
  renderTaskbar();
}

function closeAllWindows() {
  wins.forEach(w => w.el.remove());
  wins.clear();
  focusedId = null;
}

function winOf(el) {
  const box = el.closest('.win');
  return box ? wins.get(box.dataset.id) : null;
}

function rerender(app) {
  wins.forEach(w => { if (w.app === app) renderWin(w); });
}

// 다시 그려도 스크롤 위치가 튀지 않게
function renderWin(w) {
  const keep = {};
  const scrollers = ['.chat-log', '.ev-scroll', '.mail-list', '.exp-grid', '.np-text'];
  scrollers.forEach(sel => {
    const s = $(sel, w.body);
    if (s) keep[sel] = { top: s.scrollTop, bottom: s.scrollHeight - s.scrollTop - s.clientHeight < 48 };
  });

  const chatChanged = w.app === 'messenger' && w.lastChat !== w.data.chat;
  w.lastChat = w.data.chat;

  w.body.innerHTML = APPS[w.app].render(w);

  scrollers.forEach(sel => {
    const s = $(sel, w.body);
    if (!s) return;
    const k = keep[sel];
    const stick = sel === '.chat-log' || sel === '.ev-scroll';
    if (stick && (!k || k.bottom || chatChanged)) s.scrollTop = s.scrollHeight;
    else if (k) s.scrollTop = k.top;
  });

  observe();
}


/* ---------------------------------------------------------
   7. 앱 화면 그리기
   --------------------------------------------------------- */

function avatar(p, extra = '') {
  return `<span class="av ${extra}" style="--c:${p.color}">${p.ch}</span>`;
}

function chatAvatar(c) {
  if (!c.group) return avatar(PEOPLE[c.who]);
  return `<span class="av-grp">${avatar(PEOPLE[c.group[0]], 'a1')}${avatar(PEOPLE[c.group[1]], 'a2')}</span>`;
}

function isTyping(chat) {
  const ty = vm.typing[chat];
  return ty && vm.t < ty.until;
}

function chatVisible(chat) {
  for (const w of wins.values()) if (w.app === 'messenger' && !w.min && w.data.chat === chat) return true;
  return false;
}

/* 링크톡 (메신저) */
function renderMessenger(w) {
  const chat = w.data.chat;
  if (!w.min) vm.unread[chat] = 0;

  const list = CHATS.map(c => {
    const msgs = vm.msgs[c.id];
    const last = msgs[msgs.length - 1];
    const prev = isTyping(c.id) ? '<em>입력 중…</em>' : esc(last ? (last.deleted ? '삭제된 메시지입니다.' : last.text) : '');
    return `<button class="chat-item ${c.id === chat ? 'on' : ''}" data-a="chat" data-chat="${c.id}">
      ${chatAvatar(c)}
      <span class="ci-main">
        <span class="ci-top"><b>${esc(c.title)}</b>${c.count ? `<i>${c.count}</i>` : ''}<time>${last ? last.time : ''}</time></span>
        <span class="ci-prev">${prev}</span>
      </span>
      ${vm.unread[c.id] ? `<span class="badge">${vm.unread[c.id]}</span>` : ''}
    </button>`;
  }).join('');

  const c = CHATS.find(x => x.id === chat);
  let lastDay = null;
  let lastWho = null;
  const rows = vm.msgs[chat].map(m => {
    let html = '';
    if (m.day !== lastDay) {
      html += `<div class="day">${esc(m.day)}</div>`;
      lastDay = m.day;
      lastWho = null;
    }
    const p = PEOPLE[m.who];
    const me = m.who === 'seojin';
    const cont = lastWho === m.who;
    lastWho = m.who;
    const body = m.deleted
      ? '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 18 18 6" stroke="currentColor" stroke-width="2"/></svg> 삭제된 메시지입니다.'
      : esc(m.text);
    html += `<div class="m ${me ? 'me' : ''} ${cont ? 'cont' : ''} ${m.deleted ? 'deleted' : ''} ${m.fresh && !w.min ? 'fresh' : ''}">
      ${me ? '' : (cont ? '<span class="av-gap"></span>' : avatar(p))}
      <div class="m-col">
        ${!me && !cont && c.group ? `<span class="who">${esc(p.name)}</span>` : ''}
        <div class="m-row"><div class="bub">${body}</div><span class="meta">${m.unread ? '<i>1</i>' : ''}${m.time}</span></div>
      </div>
    </div>`;
    if (!w.min) m.fresh = false;
    return html;
  }).join('');

  const typing = isTyping(chat)
    ? `<div class="m typing">${avatar(PEOPLE[vm.typing[chat].who])}<div class="m-col"><div class="m-row"><div class="bub"><span class="dots"><i></i><i></i><i></i></span></div></div></div></div>`
    : '';

  const head = c.group
    ? `<b>${esc(c.title)}</b><small>${c.count}명</small>`
    : `<b>${esc(c.title)}</b><small>QA팀 · 페이로드</small>`;

  return `<div class="msgr">
    <aside class="chat-list">
      <div class="chat-list-head"><b>채팅</b><span>한서진</span></div>
      ${list}
    </aside>
    <section class="chat-pane">
      <header class="chat-head">${head}</header>
      <div class="chat-log">${rows}${typing}</div>
      <footer class="chat-input"><span>재생 중인 기록입니다 · 메시지를 보낼 수 없습니다</span><button disabled>전송</button></footer>
    </section>
  </div>`;
}

/* 메일 */
function renderMail(w) {
  const sel = vm.mails.find(m => m.id === w.data.sel);
  if (sel) vm.mailRead.add(sel.id);
  const unread = vm.mails.filter(m => !vm.mailRead.has(m.id)).length;

  const list = vm.mails.map(m => `
    <button class="mail-item ${m.id === w.data.sel ? 'on' : ''} ${vm.mailRead.has(m.id) ? '' : 'unread'} ${m.fresh ? 'fresh' : ''}" data-a="mail" data-id="${m.id}">
      <span class="mi-top"><b>${esc(m.from)}</b><time>${m.date}</time></span>
      <span class="mi-sub">${esc(m.subject)}</span>
    </button>`).join('');
  vm.mails.forEach(m => { m.fresh = false; });

  const pane = sel
    ? `<article class="mail-read">
        <h2>${esc(sel.subject)}</h2>
        <div class="mail-meta">
          <span class="av" style="--c:#8ea3d6">${esc(sel.from.slice(0, 1))}</span>
          <div><b>${esc(sel.from)}</b> <span>&lt;${esc(sel.addr)}&gt;</span><small>받는 사람: ${esc(sel.to)} · ${esc(sel.full)}</small></div>
        </div>
        <div class="mail-body">${sel.body}</div>
      </article>`
    : `<div class="empty">${icon('mail', 56)}<p>읽을 메일을 선택하세요</p></div>`;

  return `<div class="mailapp">
    <aside class="mail-side">
      <div class="mail-acc">han.seojin@payroad.kr</div>
      <div class="mail-folder on">받은편지함 <b>${unread || ''}</b></div>
      <div class="mail-folder">보낸편지함</div>
      <div class="mail-folder">임시보관함</div>
      <div class="mail-folder">스팸</div>
    </aside>
    <div class="mail-list"><div class="mail-list-head">받은편지함</div>${list}</div>
    <div class="mail-pane">${pane}</div>
  </div>`;
}

/* 파일 탐색기 */
function renderExplorer(w) {
  if (w.data.dir === 'usb' && !vm.usb) w.data.dir = 'docs';
  const dir = w.data.dir;
  const side = FOLDERS.map(([id, label, ic]) =>
    `<button class="side-item ${dir === id ? 'on' : ''}" data-a="dir" data-dir="${id}">${icon(ic, 18)}<span>${label}</span></button>`
  ).join('') +
    `<div class="side-sep"></div>
     <button class="side-item ${dir === 'usb' ? 'on' : ''} ${vm.usb ? '' : 'off'}" data-a="dir" data-dir="usb" ${vm.usb ? '' : 'disabled'}>${icon('usb', 18)}<span>USB (E:)</span><small>${vm.usb ? '연결됨' : '없음'}</small></button>`;

  const label = dir === 'usb' ? 'USB (E:)' : FOLDERS.find(f => f[0] === dir)[1];
  let grid;
  let count = 0;
  if (dir === 'usb') {
    grid = `<div class="exp-empty">${icon('usb', 48)}<p>이 드라이브의 내용은 COLD_BOOT 기록에 포함되지 않았습니다.</p><small>SanDisk Ultra · 32 GB</small></div>`;
  } else {
    const files = vm.files[dir];
    count = files.length;
    grid = files.length
      ? files.map((f, i) => `<button class="file ${w.data.selIdx === i ? 'sel' : ''} ${f.fresh ? 'fresh' : ''}" data-a="file" data-i="${i}" title="${esc(f.name)}">${icon(f.icon, 46)}<span>${esc(f.name)}</span></button>`).join('')
      : `<div class="exp-empty"><p>이 폴더는 비어 있습니다.</p></div>`;
    files.forEach(f => { f.fresh = false; });
  }

  const selFile = dir !== 'usb' && w.data.selIdx != null ? vm.files[dir][w.data.selIdx] : null;
  return `<div class="exp">
    <aside class="exp-side">${side}</aside>
    <section class="exp-main">
      <div class="exp-bar">
        <span class="nav"><svg width="14" height="14" viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg><svg width="14" height="14" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
        <span class="crumb">이 PC <i>›</i> 한서진 <i>›</i> <b>${label}</b></span>
        <span class="search">${label} 검색</span>
      </div>
      <div class="exp-grid">${grid}</div>
      <footer class="exp-status"><span>항목 ${count}개</span><span class="exp-sel">${selFile ? `${esc(selFile.name)} · ${selFile.size} · 수정 ${selFile.mod}` : ''}</span></footer>
    </section>
  </div>`;
}

/* 이벤트 뷰어 */
const LV = { info: '정보', warn: '경고', crit: '위험' };
function renderEvents() {
  const rows = vm.logs.map(l => `
    <tr class="lv-${l.lv} ${l.fresh ? 'fresh' : ''}">
      <td><span class="lv"><i></i>${LV[l.lv]}</span></td>
      <td class="mono">2026-11-20 ${l.time}</td>
      <td>${esc(l.src)}</td>
      <td>${esc(l.text)}</td>
    </tr>`).join('');
  vm.logs.forEach(l => { l.fresh = false; });
  return `<div class="ev">
    <div class="ev-head"><b>시스템 로그 <i>›</i> 전체</b><span>이벤트 ${vm.logs.length}개</span><span class="live"><i></i>실시간</span></div>
    <div class="ev-scroll"><table>
      <thead><tr><th style="width:84px">수준</th><th style="width:170px">날짜와 시간</th><th style="width:110px">원본</th><th>내용</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

/* 메모장 */
function renderDoc(w) {
  const d = DOCS[w.data.doc];
  const lines = d.text.split('\n').length;
  return `<div class="np">
    <nav class="np-menu"><span>파일</span><span>편집</span><span>서식</span><span>보기</span><span>도움말</span></nav>
    <pre class="np-text">${esc(d.text)}</pre>
    <footer class="np-status"><span>줄 ${lines}, 열 1</span><span>100%</span><span>CRLF</span><span>UTF-8</span></footer>
  </div>`;
}

/* 사진 */
function renderPhoto(w) {
  const p = PHOTOS[w.data.photo];
  return `<div class="pv">
    <div class="pv-stage"><div class="pv-frame">${p.svg}</div></div>
    <footer class="pv-info">
      <div><b>${esc(w.data.name)}</b><span>${esc(p.date)}</span></div>
      <p><small>설명</small>${esc(p.desc)}</p>
    </footer>
  </div>`;
}

/* 압축 파일 */
function renderZip(w) {
  if (!vm.unlocked) {
    return `<div class="zip-lock ${w.data.err ? 'shake' : ''}">
      <div class="zl-icon">${icon('lock', 60)}</div>
      <h3>암호가 필요합니다</h3>
      <p><b>ledger_backup.zip</b>은(는) AES-256으로 암호화되어 있습니다.</p>
      <p class="zl-hint"><small>암호 힌트</small>제천 할머니 집 와이파이</p>
      <form class="zl-form" data-form="zip">
        <input name="pw" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="암호 입력" aria-label="압축 파일 암호">
        <button type="submit">풀기</button>
      </form>
      <p class="zl-err" ${w.data.err ? '' : 'hidden'}>암호가 올바르지 않습니다.</p>
    </div>`;
  }
  return `<div class="zip-open">
    <div class="zip-head">${icon('zip', 30)}<div><b>ledger_backup.zip</b><small>압축 해제됨 · 항목 2개 · 3.4 MB</small></div></div>
    <div class="zip-list">
      <button class="zip-row" data-a="zip-csv">${icon('csv', 34)}<span><b>송금내역_요약.csv</b><small>CSV 파일 · 18 KB</small></span><i>열기</i></button>
      <button class="zip-row" data-a="zip-letter">${icon('txt', 34)}<span><b>도윤에게.txt</b><small>텍스트 문서 · 1 KB</small></span><i>열기</i></button>
    </div>
  </div>`;
}

/* 송금 내역 */
function renderCsv() {
  const fmt = n => n.toLocaleString('ko-KR');
  const total = LEDGER.reduce((s, r) => s + r[1], 0);
  const rows = LEDGER.map(([d, amt, memo], i) => `
    <tr><td class="rn">${i + 2}</td><td class="mono">${d}</td><td class="num">${fmt(amt)}</td><td>에버그린 홀딩스</td><td>${memo}</td><td class="mono hl">moon.tk</td></tr>`).join('');
  return `<div class="csv">
    <div class="csv-bar"><span class="cell-ref">F2</span><span class="fx">fx</span><span>moon.tk</span></div>
    <div class="csv-scroll"><table>
      <thead><tr><th></th><th>A · 일자</th><th>B · 금액(원)</th><th>C · 수취인</th><th>D · 적요</th><th>E · 승인자</th></tr></thead>
      <tbody>${rows}
        <tr class="sum"><td class="rn">9</td><td>합계</td><td class="num">${fmt(total)}</td><td></td><td></td><td></td></tr>
      </tbody>
    </table></div>
    <footer class="csv-foot"># 출처: ledger_prod.withdrawals (고객 예치금 계정) · 추출 2026-11-20 22:29 · han.seojin</footer>
  </div>`;
}

function renderDialog(w) {
  return `<div class="dlg">${icon('info', 34)}<p>${esc(w.data.text)}</p><button data-a="win-close">확인</button></div>`;
}

/* 파일 열기 */
function openFile(f) {
  if (!f) return;
  if (f.kind === 'doc') openApp('doc', { id: 'doc:' + f.ref, title: f.name + ' — 메모장', data: { doc: f.ref, clue: DOCS[f.ref].clue } });
  else if (f.kind === 'photo') openApp('photo', { id: 'photo:' + f.ref, title: f.name + ' — 사진', data: { photo: f.ref, name: f.name, clue: PHOTOS[f.ref].clue } });
  else if (f.kind === 'zip') openApp('zip', { data: { clue: 'zip' } });
  else openApp('dialog', { id: 'dlg:' + f.name, title: f.name, data: { text: '이 파일은 미리 볼 수 없습니다. 재생 기록에 PDF 뷰어가 포함되어 있지 않습니다.' } });
}

/* 바탕화면 아이콘 */
const DESKTOP_APPS = [
  { key: 'messenger', label: '링크톡', icon: 'chat' },
  { key: 'mail', label: '메일', icon: 'mail' },
  { key: 'explorer', label: '파일 탐색기', icon: 'folder' },
  { key: 'events', label: '이벤트 뷰어', icon: 'log' },
  { key: 'trash', label: '휴지통', icon: 'trash' },
];
let deskSel = null;

function launch(key) {
  if (key === 'trash') openApp('explorer', { data: { dir: 'trash', selIdx: null } });
  else if (key === 'explorer') openApp('explorer', { data: { selIdx: null } });
  else openApp(key);
}

function unreadMsgs() { return Object.values(vm.unread).reduce((a, b) => a + b, 0); }
function unreadMails() { return vm.mails.filter(m => !vm.mailRead.has(m.id)).length; }

function renderIcons() {
  const badges = { messenger: unreadMsgs(), mail: unreadMails() };
  const apps = DESKTOP_APPS.map(a => `
    <button class="dicon ${deskSel === a.key ? 'sel' : ''}" data-desk="${a.key}" role="listitem">
      ${icon(a.icon, 46)}<span>${a.label}</span>${badges[a.key] ? `<b class="badge">${badges[a.key]}</b>` : ''}
    </button>`).join('');
  const files = vm.files.desktop.map((f, i) => `
    <button class="dicon ${deskSel === 'f' + i ? 'sel' : ''}" data-desk="f${i}" role="listitem">${icon(f.icon, 46)}<span>${esc(f.name)}</span></button>`).join('');
  $('#icons').innerHTML = apps + files;
}

function openDesk(key) {
  if (key.startsWith('f')) openFile(vm.files.desktop[+key.slice(1)]);
  else launch(key);
}

/* 작업 표시줄 */
function renderTaskbar() {
  const pinned = ['messenger', 'mail', 'explorer', 'events'];
  const badges = { messenger: unreadMsgs(), mail: unreadMails() };
  const open = [...wins.values()];
  let html = pinned.map(app => {
    const ws = open.filter(w => w.app === app);
    const on = ws.length > 0;
    const focus = ws.some(w => w.id === focusedId);
    return `<button class="tb-app ${on ? 'open' : ''} ${focus ? 'focus' : ''}" data-tb="${app}" title="${APPS[app].title}">${icon(APPS[app].icon, 26)}${badges[app] ? `<b class="badge">${badges[app]}</b>` : ''}</button>`;
  }).join('');
  const extra = open.filter(w => !pinned.includes(w.app));
  if (extra.length) {
    html += '<span class="tb-div"></span>' + extra.map(w =>
      `<button class="tb-app open ${w.id === focusedId ? 'focus' : ''}" data-tbw="${esc(w.id)}" title="${esc(w.title)}">${icon(w.icon, 24)}</button>`).join('');
  }
  $('#tb-apps').innerHTML = html;
}

function refreshBadges() {
  renderIcons();
  renderTaskbar();
}

/* 시작 메뉴 */
function openStart() {
  const el = $('#startmenu');
  el.innerHTML = `
    <div class="sm-user"><span class="av" style="--c:#7aa2ff">서</span><div><b>한서진</b><small>DEV-HANSJ-03 · payroad.kr</small></div></div>
    <div class="sm-label">고정됨</div>
    <div class="sm-grid">
      ${DESKTOP_APPS.map(a => `<button class="sm-app" data-a="sm-app" data-key="${a.key}">${icon(a.icon, 34)}<span>${a.label}</span></button>`).join('')}
      <button class="sm-app" data-a="sm-notes">${icon('notes', 34)}<span>수사 노트</span></button>
    </div>
    <div class="sm-foot">
      <span>COLD_BOOT 0.3.1 · 재생 중 ${clockText(vm.t)}</span>
      <button class="sm-rewind" data-a="rewind">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.5-5.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        22:00으로 되감기
      </button>
    </div>`;
  el.hidden = false;
  $('#btn-start').classList.add('on');
}

function closeStart() {
  $('#startmenu').hidden = true;
  $('#btn-start').classList.remove('on');
}

/* 알림 */
function toast({ ic, app, title, text, host = false, onClick }) {
  const box = $('#toasts');
  const el = document.createElement('button');
  el.className = 'toast' + (host ? ' host' : '');
  el.innerHTML = `<span class="t-ic">${icon(ic, host ? 22 : 30)}</span><span class="t-main"><small>${esc(app)}</small><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}</span>`;
  const dismiss = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  };
  el.addEventListener('click', () => { if (onClick) onClick(); dismiss(); });
  box.appendChild(el);
  while (box.children.length > 4) box.firstElementChild.remove();
  setTimeout(dismiss, host ? 3600 : 5200);
}


/* ---------------------------------------------------------
   8. 관찰 → 단서 기록
   창이 열려 있고(최소화 안 됨) 그 순간 화면에 있는 것만 기록된다.
   --------------------------------------------------------- */

function observe() {
  if (!running && !vm.wiping) return;
  wins.forEach(w => {
    if (w.min) return;
    if (w.app === 'messenger') {
      vm.msgs[w.data.chat].forEach(m => { if (m.clue && !m.deleted) gain(m.clue); });
    } else if (w.app === 'events') {
      vm.logs.forEach(l => { if (l.clue) gain(l.clue); });
    } else if (w.app === 'mail') {
      const m = vm.mails.find(x => x.id === w.data.sel);
      if (m && m.clue) gain(m.clue);
    } else if (w.app === 'csv') {
      gain('ledger');
    } else if (w.data.clue) {
      gain(w.data.clue);
    }
  });
}

function gain(id) {
  if (save.clues[id] || !CLUES[id]) return;
  save.clues[id] = save.loop;
  newClues.add(id);
  persist();
  toast({ ic: 'notes', app: 'HOST · 수사 노트에 기록', title: CLUES[id].title, host: true, onClick: openNotes });
  $('#notes-count').textContent = Object.keys(save.clues).length;
  const btn = $('#btn-notes');
  btn.classList.remove('ping');
  void btn.offsetWidth;
  btn.classList.add('ping');
  renderTimelineMarks();
  if (notesOpen) renderNotes();
}


/* ---------------------------------------------------------
   9. 시간 흐름과 사건
   --------------------------------------------------------- */

function fire(e) {
  switch (e.type) {
    case 'msg': {
      vm.msgs[e.chat].push({ day: TODAY, time: e.t, who: e.who, text: e.text, clue: e.clue, key: e.key, unread: e.unread, fresh: true });
      if (vm.typing[e.chat] && vm.typing[e.chat].who === e.who) delete vm.typing[e.chat];
      if (e.who !== 'seojin' && !chatVisible(e.chat)) {
        vm.unread[e.chat] += 1;
        const c = CHATS.find(x => x.id === e.chat);
        toast({ ic: 'chat', app: '링크톡', title: c.title, text: '새 메시지가 있습니다', onClick: () => openApp('messenger', { data: { chat: e.chat } }) });
      }
      rerender('messenger');
      break;
    }
    case 'typing':
      vm.typing[e.chat] = { who: e.who, until: tm(e.until) };
      rerender('messenger');
      break;
    case 'delete': {
      const m = vm.msgs[e.chat].find(x => x.key === e.key);
      if (m) m.deleted = true;
      rerender('messenger');
      break;
    }
    case 'mail':
      vm.mails.unshift({ ...e.mail, fresh: true });
      toast({ ic: 'mail', app: '메일', title: e.mail.from, text: e.mail.subject, onClick: () => openApp('mail', { data: { sel: e.mail.id } }) });
      rerender('mail');
      break;
    case 'log':
      vm.logs.push({ ...e.log, fresh: true });
      rerender('events');
      break;
    case 'file':
      vm.files[e.dir].push({ ...e.file, fresh: true });
      rerender('explorer');
      break;
    case 'usb':
      vm.usb = e.on;
      rerender('explorer');
      break;
    case 'wipe':
      startWipe();
      break;
  }
  refreshBadges();
}

function updateClock() {
  $('#clock-time').textContent = clockText(vm.t);
  $('#tl-fill').style.width = (vm.t / LOOP_LEN * 100) + '%';
  stage.classList.toggle('tense', vm.t >= tm('23:55'));
  stage.classList.toggle('late', vm.t >= tm('23:30'));
}

function renderTimelineMarks() {
  $('#tl-marks').innerHTML = Object.keys(save.clues)
    .filter(id => CLUES[id].t)
    .map(id => `<i style="left:${tm(CLUES[id].t) / LOOP_LEN * 100}%" title="${CLUES[id].t} ${esc(CLUES[id].title)}"></i>`)
    .join('');
}

function glitchPulse() {
  stage.style.setProperty('--gy', Math.floor(Math.random() * 640) + 'px');
  stage.classList.add('glitch');
  setTimeout(() => stage.classList.remove('glitch'), 160);
}

function frame(now) {
  const dt = Math.min(0.25, (now - lastFrame) / 1000);
  lastFrame = now;

  if (running && !paused) {
    vm.t = Math.min(LOOP_LEN, vm.t + dt * speed / SEC_PER_MIN);
    while (vm.ev < EVENTS.length && EVENTS[vm.ev].m <= vm.t) fire(EVENTS[vm.ev++]);
    updateClock();
    updateWipe();

    const minute = Math.floor(vm.t);
    if (minute !== lastMinute) {
      lastMinute = minute;
      observe();
    }
    if (vm.t >= tm('23:52') && !REDUCED && Math.random() < dt * (vm.t >= WIPE_AT ? 2.2 : 0.5)) glitchPulse();
    if (vm.t >= LOOP_LEN) endLoop('end');
  }

  drawRain(dt);
  requestAnimationFrame(frame);
}


/* ---------------------------------------------------------
   10. 원격 초기화, 회차 끝, 부팅
   --------------------------------------------------------- */

const WIPE_PATHS = [
  'C:\\Users\\seojin\\Documents\\업무일지_11월.txt',
  'C:\\Users\\seojin\\Downloads\\ledger_backup.zip',
  'C:\\Users\\seojin\\Pictures\\2009_제천_할머니집.jpg',
  'C:\\Users\\seojin\\Pictures\\2009_비밀기지.jpg',
  'C:\\Users\\seojin\\Pictures\\2021_강릉_워크숍.jpg',
  'C:\\Users\\seojin\\AppData\\Local\\LinkTalk\\chat.db',
  'C:\\Users\\seojin\\AppData\\Local\\LinkTalk\\media\\',
  'C:\\Users\\seojin\\Desktop\\COLD_BOOT_메모.txt',
  'C:\\Users\\seojin\\Documents\\이력서_한서진_2024.pdf',
  'C:\\Users\\seojin\\AppData\\Roaming\\Mail\\inbox.mbx',
  'C:\\ProgramData\\COLD_BOOT\\snapshot.idx',
  'C:\\Users\\seojin\\$Recycle.Bin\\하린_생일선물.txt',
  'C:\\Users\\seojin\\source\\payroad-settlement\\',
  'C:\\Users\\seojin\\.ssh\\id_ed25519',
];

function startWipe() {
  vm.wiping = true;
  vm.wipeN = 0;
  closeStart();
  const el = $('#wipe');
  el.innerHTML = `<div class="wipe-panel">
    <div class="wipe-top">${SVG_WARN}<div><small>페이로드 MDM · 원격 명령</small><h2>이 기기를 초기화하는 중입니다</h2></div></div>
    <p>승인 계정 <b>kang.jh</b> · 대상 DEV-HANSJ-03 · 이 작업은 되돌릴 수 없습니다.</p>
    <div class="wipe-bar"><i id="wipe-fill"></i></div>
    <div class="wipe-row"><span id="wipe-pct">0%</span><span>컴퓨터를 끄지 마세요</span></div>
    <ol id="wipe-files"></ol>
  </div>`;
  el.hidden = false;
}

function updateWipe() {
  if (!vm.wiping) return;
  const p = clamp((vm.t - WIPE_AT) / (LOOP_LEN - WIPE_AT), 0, 1);
  const fill = $('#wipe-fill');
  if (!fill) return;
  fill.style.width = (p * 100) + '%';
  $('#wipe-pct').textContent = Math.floor(p * 100) + '%';
  const list = $('#wipe-files');
  while (vm.wipeN < Math.floor(p * 64)) {
    const li = document.createElement('li');
    const path = WIPE_PATHS[vm.wipeN % WIPE_PATHS.length];
    li.innerHTML = `<span>삭제</span>${esc(path)}`;
    list.appendChild(li);
    while (list.children.length > 7) list.firstElementChild.remove();
    vm.wipeN += 1;
  }
}

function endLoop(reason) {
  if (transitioning) return;
  transitioning = true;
  running = false;
  closeStart();
  if (notesOpen) closeNotes();

  const el = $('#lost');
  el.innerHTML = `<div class="lost-inner">
    <b data-text="SIGNAL LOST">SIGNAL LOST</b>
    <span>${reason === 'manual' ? '사용자 요청 · 재생을 되감습니다' : '기록 종료 · 23:58:12 이후 데이터 없음'}</span>
    <span class="lost-sub">스냅샷 2026-11-20 22:00:00 으로 되돌리는 중…</span>
  </div>`;
  el.hidden = false;
  stage.classList.add('glitch-hard');

  setTimeout(() => {
    save.loop += 1;
    persist();
    stage.classList.remove('glitch-hard');
    el.hidden = true;
    boot();
  }, 2300);
}

function boot() {
  transitioning = false;
  running = false;
  paused = false;
  closeAllWindows();
  closeStart();
  vm = freshVM();
  lastMinute = -1;
  deskSel = null;
  $('#wipe').hidden = true;
  $('#wipe').innerHTML = '';
  $('#toasts').innerHTML = '';
  $('#veil').hidden = true;
  stage.classList.remove('tense', 'late', 'glitch');
  $('#loop-tag').textContent = 'LOOP ' + pad2(save.loop);
  $('#notes-count').textContent = Object.keys(save.clues).length;
  refreshBadges();
  updateClock();
  renderTimelineMarks();

  const el = $('#boot');
  el.hidden = false;
  if (save.loop === 1 && !save.intro) showIntro();
  else showBootLog();
}

function showIntro() {
  const el = $('#boot');
  el.className = 'intro-mode';
  el.innerHTML = `<div class="intro">
    <div class="intro-card">
      <div class="intro-app"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span>받은편지함 — doyun.han@mail.kr</span></div>
      <div class="intro-head">
        <span class="av" style="--c:#7aa2ff">서</span>
        <div><b>한서진</b> <span>&lt;seojin.han.dev@mail.kr&gt;</span><small>받는 사람: 한도윤 · 2026-11-23 (월) 22:00 · 예약 발송</small></div>
      </div>
      <h1>[자동 발송] 도윤아</h1>
      <div class="intro-body">
        <p>이 메일이 도착했다면, 나는 사흘 동안 로그인하지 못한 거야.</p>
        <p>첨부한 건 11월 20일 밤의 내 PC야. 켜면 그날 밤 10시부터 자정까지가 그대로 다시 재생돼. 자정이 되면 처음으로 돌아가. 몇 번이든.</p>
        <p>그날 밤에 무슨 일이 있었는지, 네가 대신 봐 줘.</p>
        <p class="sign">— 누나</p>
      </div>
      <div class="intro-att">${icon('zip', 34)}<div><b>COLD_BOOT_20261120.vmimg</b><small>38.2 GB · 가상 머신 이미지</small></div></div>
      <button class="intro-go" data-a="intro-go">이미지 열기</button>
    </div>
    <p class="intro-note">11월 25일 새벽. 누나와 연락이 끊긴 지 닷새째.</p>
  </div>`;
}

let bootTimer = null;

function showBootLog() {
  const el = $('#boot');
  el.className = 'boot-mode';
  const n = Object.keys(save.clues).length;
  const lines = [
    ['', 'COLD_BOOT hypervisor 0.3.1 · personal build · han.seojin'],
    ['dim', '"재생은 바꿀 수 없어. 하지만 보는 건 몇 번이고 할 수 있어."'],
    ['', ''],
    ['ok', '이미지 확인 ········ COLD_BOOT_20261120.vmimg (38.2 GB)'],
    ['ok', '무결성 검사 ········ SHA-256 일치'],
    ['ok', '스냅샷 복원 ········ 2026-11-20 (금) 22:00:00 KST'],
    ['ok', `기록 적재 ·········· 메신저 ${COUNT.msg} · 메일 ${COUNT.mail} · 시스템 로그 ${COUNT.log} · 파일 변경 1`],
    ['ok', '재생 모드 ·········· 읽기 전용 · 기록된 사건은 바뀌지 않음'],
    ['warn', '기록 종료 지점 ······ 23:58:12 · 원격 초기화 감지'],
    ['ok', `호스트 노트 연결 ···· 단서 ${n}개 보존됨`],
    ['', ''],
    ['', `> 리플레이 ${save.loop}회차 준비 완료`],
  ];
  const tip = BOOT_TIPS[Math.min(save.loop - 1, BOOT_TIPS.length - 1)];

  el.innerHTML = `<div class="boot-wrap">
    <div class="boot-log" id="boot-log"></div>
    <div class="boot-side">
      <small>REPLAY</small>
      <div class="boot-num">LOOP <b>${pad2(save.loop)}</b></div>
      <div class="boot-bar"><i id="boot-fill"></i></div>
      <div class="boot-meta"><span>22:00</span><span>23:58</span></div>
      <button class="boot-start" data-a="boot-start" id="boot-start" hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>
        재생 시작
      </button>
      <p class="boot-tip" id="boot-tip" hidden><small>TIP</small>${esc(tip)}</p>
    </div>
  </div>`;

  const log = $('#boot-log');
  let i = 0;
  const step = () => {
    if (i >= lines.length) { finishBoot(); return; }
    const [cls, txt] = lines[i];
    const div = document.createElement('div');
    div.className = 'bl ' + cls;
    div.innerHTML = cls === 'ok' ? `<span class="st">[ ok ]</span>${esc(txt)}` : cls === 'warn' ? `<span class="st">[warn]</span>${esc(txt)}` : (esc(txt) || '&nbsp;');
    log.appendChild(div);
    i += 1;
    $('#boot-fill').style.width = (i / lines.length * 100) + '%';
    bootTimer = setTimeout(step, txt ? 90 + Math.random() * 160 : 60);
  };
  el.dataset.done = '';
  el.skip = () => {
    clearTimeout(bootTimer);
    while (i < lines.length) {
      const [cls, txt] = lines[i];
      const div = document.createElement('div');
      div.className = 'bl ' + cls;
      div.innerHTML = cls === 'ok' ? `<span class="st">[ ok ]</span>${esc(txt)}` : cls === 'warn' ? `<span class="st">[warn]</span>${esc(txt)}` : (esc(txt) || '&nbsp;');
      log.appendChild(div);
      i += 1;
    }
    finishBoot();
  };
  bootTimer = setTimeout(step, 300);
}

function finishBoot() {
  const el = $('#boot');
  el.dataset.done = '1';
  $('#boot-fill').style.width = '100%';
  $('#boot-start').hidden = false;
  $('#boot-tip').hidden = false;
  $('#boot-start').focus();
}

function startLoop() {
  const el = $('#boot');
  if (running || el.hidden || el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove('leaving');
    running = true;
    lastFrame = performance.now();
    toast({ ic: 'info', app: 'COLD_BOOT', title: '재생을 시작합니다', text: `LOOP ${pad2(save.loop)} · 자정까지 120분` });
  }, 380);
}


/* ---------------------------------------------------------
   11. 수사 노트와 보고서
   --------------------------------------------------------- */

function openNotes() {
  if (transitioning || !$('#boot').hidden) return;
  notesOpen = true;
  paused = true;
  closeStart();
  renderNotes();
  $('#notes').classList.add('open');
  $('#veil').hidden = false;
}

function closeNotes() {
  notesOpen = false;
  paused = false;
  lastFrame = performance.now();
  resetArmed = false;
  newClues.clear();
  $('#notes').classList.remove('open');
  $('#veil').hidden = true;
}

function clueCard(id) {
  const c = CLUES[id];
  return `<article class="clue ${newClues.has(id) ? 'new' : ''}">
    <time>${c.t || '자료'}</time>
    <div>
      <h4>${esc(c.title)}</h4>
      <p>${esc(c.body)}</p>
      <small>${esc(c.src)} · LOOP ${pad2(save.clues[id])}에서 발견</small>
    </div>
  </article>`;
}

function renderNotes() {
  const ids = Object.keys(save.clues);
  const total = Object.keys(CLUES).length;
  let body = '';

  if (notesTab === 'timeline') {
    const timed = ids.filter(id => CLUES[id].t).sort((a, b) => tm(CLUES[a].t) - tm(CLUES[b].t));
    body = timed.length
      ? `<div class="tl-list">${timed.map(clueCard).join('')}</div>`
      : '<p class="nb-empty">아직 시각이 확인된 사건이 없습니다. 무언가를 보는 순간 이곳에 적힙니다.</p>';
    body += `<label class="nb-memo"><span>다음 회차 계획</span><textarea id="nb-memo" rows="4" placeholder="예) 23:40 전에 하린 대화창 열어 두기">${esc(save.memo)}</textarea></label>`;
  } else if (notesTab === 'files') {
    const docs = ids.filter(id => !CLUES[id].t);
    body = docs.length
      ? docs.map(clueCard).join('')
      : '<p class="nb-empty">파일, 메일, 사진에서 얻은 자료가 이곳에 모입니다.</p>';
  } else {
    body = `<form class="rep" data-form="report">
      <p class="rep-lead">세 질문에 답해 보고서를 제출하세요. 몇 개가 맞았는지만 알려 줍니다.</p>
      ${REPORT.map(r => `<fieldset class="rep-q"><legend>${esc(r.q)}</legend>
        ${r.opts.map(([v, label]) => `<label class="rep-opt"><input type="radio" name="${r.id}" value="${v}" ${save.answers[r.id] === v ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}
      </fieldset>`).join('')}
      <button type="submit" class="rep-submit">보고서 제출</button>
      <p class="rep-msg" id="rep-msg" aria-live="polite"></p>
    </form>`;
  }

  const hintId = HINTS.find(([id]) => !save.clues[id]);
  $('#notes').innerHTML = `
    <header class="nb-head">
      <div><small>HOST · 도윤의 노트북</small><h2>수사 노트</h2></div>
      <button class="nb-close" data-a="notes-close" aria-label="수사 노트 닫기">${SVG_X}</button>
    </header>
    <div class="nb-stats">
      <span><small>회차</small><b>LOOP ${pad2(save.loop)}</b></span>
      <span><small>단서</small><b>${ids.length}<i>/${total}</i></b></span>
      <span><small>멈춘 시각</small><b>${clockText(vm.t)}</b></span>
    </div>
    <nav class="nb-tabs">
      <button class="${notesTab === 'timeline' ? 'on' : ''}" data-a="tab" data-tab="timeline">타임라인</button>
      <button class="${notesTab === 'files' ? 'on' : ''}" data-a="tab" data-tab="files">자료</button>
      <button class="${notesTab === 'report' ? 'on' : ''}" data-a="tab" data-tab="report">보고서</button>
    </nav>
    <div class="nb-body">${body}</div>
    <footer class="nb-foot">
      ${hintId ? `<button class="nb-hint" data-a="hint">막혔을 때 힌트</button>` : ''}
      <p class="nb-hint-text" id="nb-hint-text" hidden></p>
      <button class="nb-reset" data-a="reset">${resetArmed ? '정말 지울까요? 한 번 더 누르세요' : '기록 전부 지우고 처음부터'}</button>
    </footer>`;
}

function submitReport(form) {
  const fd = new FormData(form);
  const msg = $('#rep-msg');
  const picks = REPORT.map(r => fd.get(r.id));
  REPORT.forEach((r, i) => { if (picks[i]) save.answers[r.id] = picks[i]; });
  persist();
  if (picks.some(p => !p)) {
    msg.textContent = '세 질문에 모두 답해 주세요.';
    msg.className = 'rep-msg warn';
    return;
  }
  save.reports += 1;
  persist();
  const right = REPORT.filter((r, i) => r.answer === picks[i]).length;
  if (right === 3) {
    msg.textContent = '보고서가 받아들여졌습니다.';
    msg.className = 'rep-msg ok';
    setTimeout(showEnding, 900);
  } else {
    msg.textContent = `반려 · 3개 중 ${right}개 일치. 아직 보지 못한 순간이 있습니다.`;
    msg.className = 'rep-msg bad';
  }
}

function resetAll() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
  save = defaultSave();
  notesTab = 'timeline';
  if (notesOpen) closeNotes();
  $('#ending').hidden = true;
  boot();
}


/* ---------------------------------------------------------
   12. 엔딩
   --------------------------------------------------------- */

function showEnding() {
  running = false;
  if (notesOpen) closeNotes();
  save.solved = true;
  persist();
  const n = Object.keys(save.clues).length;
  const total = Object.keys(CLUES).length;
  const el = $('#ending');
  el.innerHTML = `
    <div class="end-sky"><div class="end-sun"></div><svg class="end-hills" viewBox="0 0 1280 260" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 140C180 60 320 110 470 90 640 40 760 110 920 80 1080 50 1180 100 1280 70V260H0Z" fill="#2b2a4f"/>
      <path d="M0 190C160 150 300 170 460 160 640 130 800 180 980 150 1120 130 1220 160 1280 150V260H0Z" fill="#1b1a36"/>
      <path d="M880 170h120v-46l-60-34-60 34z" fill="#121128"/><rect x="926" y="128" width="16" height="12" fill="#f2b45a" opacity=".9"/>
    </svg></div>
    <div class="end-inner">
      <small>11월 25일 · 오전 5시 41분 · 충북 제천</small>
      <h1>사다리는 치워져 있었다.</h1>
      <div class="end-text">
        <p>창고 문을 열자 먼지 냄새가 먼저 났다. 위를 보고 이름을 부르자, 한참 뒤에 다락 판자가 밀려났다.</p>
        <p>"늦었네." 서진은 손전등을 끄며 말했다. 손에는 SanDisk USB가 들려 있었다.</p>
        <p>그날 오후, 도윤의 보고서와 USB 원본은 금융감독원과 경찰에 함께 넘겨졌다. 원격 초기화 명령을 보낸 기기는 QA-HARIN-01이었고, 2분 만에 지워진 메시지의 수신자는 문태경이었다.</p>
        <p>COLD_BOOT 이미지는 그 뒤로 다시 켜지지 않았다.</p>
      </div>
      <dl class="end-stats">
        <div><dt>리플레이</dt><dd>${save.loop}회</dd></div>
        <div><dt>찾은 단서</dt><dd>${n}/${total}</dd></div>
        <div><dt>보고서 제출</dt><dd>${save.reports}회</dd></div>
      </dl>
      <div class="end-actions">
        <button data-a="restart-all" class="primary">처음부터 다시</button>
        <button data-a="end-close">계속 둘러보기</button>
      </div>
    </div>`;
  el.hidden = false;
}


/* ---------------------------------------------------------
   13. 배경 (도시, 비)
   --------------------------------------------------------- */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function buildCity() {
  const rnd = mulberry32(20261120);
  const layers = [
    { base: 712, min: 150, max: 330, wmin: 34, wmax: 80, fill: '#111a33', lit: 0.07, wc: ['#5d78c4', '#7f95d8'], step: 10 },
    { base: 712, min: 90, max: 250, wmin: 50, wmax: 110, fill: '#0b1226', lit: 0.12, wc: ['#f2c46a', '#ffdf9e', '#9fb7ff'], step: 13 },
    { base: 712, min: 50, max: 150, wmin: 70, wmax: 150, fill: '#070b18', lit: 0.18, wc: ['#ffcf7a', '#ffe7b0', '#ff9f6b'], step: 15 },
  ];
  let svg = '';
  let flick = 0;
  layers.forEach((L, li) => {
    let x = -20;
    while (x < W + 20) {
      const bw = L.wmin + rnd() * (L.wmax - L.wmin);
      const bh = L.min + rnd() * (L.max - L.min);
      const top = L.base - bh;
      svg += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${L.fill}"/>`;
      // 옥상 구조물
      if (rnd() < 0.35) svg += `<rect x="${(x + bw * 0.2).toFixed(1)}" y="${(top - 10).toFixed(1)}" width="${(bw * 0.25).toFixed(1)}" height="10" fill="${L.fill}"/>`;
      if (li === 0 && rnd() < 0.18) svg += `<circle class="beacon" cx="${(x + bw / 2).toFixed(1)}" cy="${(top - 4).toFixed(1)}" r="2.2" fill="#ff4d5e" style="animation-delay:${(rnd() * 2).toFixed(2)}s"/>`;
      // 창문
      for (let wy = top + 10; wy < L.base - 10; wy += L.step) {
        for (let wx = x + 6; wx < x + bw - 8; wx += L.step - 3) {
          if (rnd() < L.lit) {
            const c = L.wc[Math.floor(rnd() * L.wc.length)];
            const fl = rnd() < 0.05 && flick < 26;
            if (fl) flick += 1;
            svg += `<rect ${fl ? `class="fl" style="animation-delay:${(rnd() * 6).toFixed(2)}s"` : ''} x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${(L.step - 8).toFixed(1)}" height="${(L.step - 7).toFixed(1)}" fill="${c}" opacity="${(0.45 + rnd() * 0.5).toFixed(2)}"/>`;
          }
        }
      }
      x += bw + rnd() * 6;
    }
  });
  $('#city').innerHTML = svg;
}

const rain = { ctx: null, drops: [], splashes: [] };

function newDrop(anywhere) {
  const z = Math.random();
  return {
    x: Math.random() * (W + 200) - 40,
    y: anywhere ? Math.random() * 712 : -30 - Math.random() * 200,
    len: 10 + z * 22,
    v: 480 + z * 520,
    a: 0.07 + z * 0.22,
    z,
  };
}

function initRain() {
  rain.ctx = $('#rain').getContext('2d');
  const n = REDUCED ? 60 : 230;
  for (let i = 0; i < n; i += 1) rain.drops.push(newDrop(true));
}

function drawRain(dt) {
  const ctx = rain.ctx;
  if (!ctx || document.hidden) return;
  ctx.clearRect(0, 0, W, 712);
  ctx.lineCap = 'round';
  const slant = 0.2;
  rain.drops.forEach((d, i) => {
    d.y += d.v * dt;
    d.x -= d.v * dt * slant;
    ctx.strokeStyle = `rgba(190,208,255,${d.a})`;
    ctx.lineWidth = 0.8 + d.z * 0.7;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + d.len * slant, d.y - d.len);
    ctx.stroke();
    if (d.y > 700) {
      if (d.z > 0.55 && rain.splashes.length < 40) rain.splashes.push({ x: d.x, y: 704 - Math.random() * 6, r: 0, a: d.a + 0.1 });
      rain.drops[i] = newDrop(false);
    }
  });
  rain.splashes = rain.splashes.filter(s => {
    s.r += dt * 26;
    s.a -= dt * 0.9;
    if (s.a <= 0) return false;
    ctx.strokeStyle = `rgba(200,216,255,${s.a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r, s.r * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    return true;
  });
}


/* ---------------------------------------------------------
   14. 입력 연결과 시작
   --------------------------------------------------------- */

// 버튼 클릭 (data-a)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]');
  if (!t) return;
  const a = t.dataset.a;
  const w = winOf(t);

  switch (a) {
    case 'win-min': minimizeWin(w); break;
    case 'win-close': closeWin(w); break;
    case 'chat': w.data.chat = t.dataset.chat; renderWin(w); refreshBadges(); break;
    case 'mail': w.data.sel = t.dataset.id; renderWin(w); refreshBadges(); break;
    case 'dir': w.data.dir = t.dataset.dir; w.data.selIdx = null; renderWin(w); break;
    case 'file': {
      const i = +t.dataset.i;
      if (COARSE) { openFile(vm.files[w.data.dir][i]); break; }
      w.data.selIdx = i;
      $$('.file', w.body).forEach(f => f.classList.toggle('sel', f === t));
      const f = vm.files[w.data.dir][i];
      $('.exp-sel', w.body).textContent = `${f.name} · ${f.size} · 수정 ${f.mod}`;
      break;
    }
    case 'zip-csv': openApp('csv', { data: { clue: 'ledger' } }); break;
    case 'zip-letter': openApp('doc', { id: 'doc:letter', title: '도윤에게.txt — 메모장', data: { doc: 'letter', clue: 'letter' } }); break;
    case 'sm-app': closeStart(); launch(t.dataset.key); break;
    case 'sm-notes': closeStart(); openNotes(); break;
    case 'rewind': closeStart(); endLoop('manual'); break;
    case 'notes-close': closeNotes(); break;
    case 'tab': notesTab = t.dataset.tab; renderNotes(); break;
    case 'hint': {
      const h = HINTS.find(([id]) => !save.clues[id]);
      const p = $('#nb-hint-text');
      if (h && p) { p.textContent = h[1]; p.hidden = false; t.hidden = true; }
      break;
    }
    case 'reset':
      if (resetArmed) resetAll();
      else { resetArmed = true; renderNotes(); }
      break;
    case 'intro-go': save.intro = true; persist(); showBootLog(); break;
    case 'boot-start': startLoop(); break;
    case 'restart-all': resetAll(); break;
    case 'end-close':
      $('#ending').hidden = true;
      running = vm.t < LOOP_LEN;
      lastFrame = performance.now();
      break;
  }
});

// 더블클릭으로 파일 열기
document.addEventListener('dblclick', e => {
  const f = e.target.closest('[data-a="file"]');
  if (f) {
    const w = winOf(f);
    openFile(vm.files[w.data.dir][+f.dataset.i]);
  }
});

// 바탕화면 아이콘
$('#icons').addEventListener('click', e => {
  const b = e.target.closest('[data-desk]');
  if (!b) return;
  if (COARSE) { openDesk(b.dataset.desk); return; }
  deskSel = b.dataset.desk;
  $$('.dicon').forEach(x => x.classList.toggle('sel', x === b));
});
$('#icons').addEventListener('dblclick', e => {
  const b = e.target.closest('[data-desk]');
  if (b) openDesk(b.dataset.desk);
});
$('#icons').addEventListener('keydown', e => {
  const b = e.target.closest('[data-desk]');
  if (b && e.key === 'Enter') { e.preventDefault(); openDesk(b.dataset.desk); }
});
$('#wall').addEventListener('click', () => {
  deskSel = null;
  $$('.dicon').forEach(x => x.classList.remove('sel'));
});

// 작업 표시줄
$('#tb-apps').addEventListener('click', e => {
  const b = e.target.closest('[data-tb], [data-tbw]');
  if (!b) return;
  let w = null;
  if (b.dataset.tbw) w = wins.get(b.dataset.tbw);
  else w = [...wins.values()].filter(x => x.app === b.dataset.tb).sort((p, q) => +q.el.style.zIndex - +p.el.style.zIndex)[0];
  if (!w) { launch(b.dataset.tb); return; }
  if (w.id === focusedId && !w.min) minimizeWin(w);
  else { w.min = false; w.el.classList.remove('min'); focusWin(w); renderWin(w); }
});

$('#btn-start').addEventListener('click', () => {
  if ($('#startmenu').hidden) openStart(); else closeStart();
});
$('#btn-notes').addEventListener('click', () => {
  if (notesOpen) closeNotes(); else openNotes();
});
$('#speed').addEventListener('click', e => {
  const b = e.target.closest('[data-speed]');
  if (!b) return;
  speed = +b.dataset.speed;
  $$('#speed button').forEach(x => x.classList.toggle('on', x === b));
});
$('#veil').addEventListener('click', closeNotes);

// 부팅 화면: 클릭하면 로그를 건너뜀
$('#boot').addEventListener('click', e => {
  const el = $('#boot');
  if (e.target.closest('[data-a]')) return;
  if (el.classList.contains('boot-mode') && !el.dataset.done && el.skip) el.skip();
});

// 폼 (압축 암호, 보고서)
document.addEventListener('submit', e => {
  const form = e.target;
  e.preventDefault();
  if (form.dataset.form === 'zip') {
    const w = winOf(form);
    const pw = new FormData(form).get('pw').trim().toLowerCase();
    if (pw === 'jecheon0807') {
      vm.unlocked = true;
      w.data.err = false;
      renderWin(w);
      toast({ ic: 'zip', app: '압축 해제', title: 'ledger_backup.zip', text: '항목 2개를 풀었습니다' });
    } else {
      w.data.err = true;
      renderWin(w);
      const input = $('input', w.body);
      if (input) input.focus();
    }
  } else if (form.dataset.form === 'report') {
    submitReport(form);
  }
});

// 다음 회차 계획 메모 저장
document.addEventListener('input', e => {
  if (e.target.id === 'nb-memo') {
    save.memo = e.target.value;
    persist();
  }
});

// 창 끌기와 포커스
let drag = null;
document.addEventListener('pointerdown', e => {
  const box = e.target.closest('.win');
  if (box) focusWin(wins.get(box.dataset.id));
  const bar = e.target.closest('.titlebar');
  if (bar && box && !e.target.closest('button')) {
    const w = wins.get(box.dataset.id);
    drag = { w, sx: e.clientX, sy: e.clientY, x: w.el.offsetLeft, y: w.el.offsetTop };
    w.el.classList.add('dragging');
    e.preventDefault();
  }
  if (!e.target.closest('#startmenu') && !e.target.closest('#btn-start')) closeStart();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const el = drag.w.el;
  const x = clamp(drag.x + (e.clientX - drag.sx) / scale, -el.offsetWidth + 100, W - 100);
  const y = clamp(drag.y + (e.clientY - drag.sy) / scale, 0, H - TASKBAR - 36);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
});
const endDrag = () => {
  if (drag) { drag.w.el.classList.remove('dragging'); drag = null; }
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// 키보드
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (notesOpen) closeNotes();
    closeStart();
  }
  const bootEl = $('#boot');
  if (!bootEl.hidden && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('input, textarea')) {
    if (bootEl.classList.contains('intro-mode')) { save.intro = true; persist(); showBootLog(); e.preventDefault(); }
    else if (bootEl.dataset.done) { startLoop(); e.preventDefault(); }
    else if (bootEl.skip) { bootEl.skip(); e.preventDefault(); }
  }
});

addEventListener('resize', fit);
document.addEventListener('visibilitychange', () => { lastFrame = performance.now(); });

// 시작
fit();
buildCity();
initRain();
boot();
requestAnimationFrame(t => { lastFrame = t; frame(t); });
