/**
 * Earnings calendar manual source.
 * 운영자가 직접 일정/시간을 업데이트하는 용도입니다.
 * phase examples: BMO, AMC, 引け後, Before Open
 */
export const EARNINGS_CALENDAR_MANUAL = {
  US: [
    { id: 'us-1', symbol: 'NVDA', company: 'NVIDIA', when: 'Tue 08:30 ET', phase: 'BMO' },
    { id: 'us-2', symbol: 'AAPL', company: 'Apple', when: 'Wed 16:05 ET', phase: 'AMC' },
    { id: 'us-3', symbol: 'MSFT', company: 'Microsoft', when: 'Thu 16:10 ET', phase: 'AMC' },
  ],
  JP: [
    { id: 'jp-1', symbol: '7203', company: 'トヨタ自動車', when: '火 15:00 JST', phase: '引け後' },
    { id: 'jp-2', symbol: '6758', company: 'ソニーG', when: '水 15:00 JST', phase: '引け後' },
    { id: 'jp-3', symbol: '8035', company: '東京エレクトロン', when: '木 15:00 JST', phase: '引け後' },
  ],
  UK: [
    { id: 'uk-1', symbol: 'HSBC', company: 'HSBC', when: 'Wed 07:00 GMT', phase: 'Before Open' },
  ],
  EU: [
    { id: 'eu-1', symbol: 'ASML', company: 'ASML', when: 'Thu 07:00 CET', phase: 'Before Open' },
  ],
}

