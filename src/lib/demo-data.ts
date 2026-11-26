export type Coordinates = { lat: number; lng: number };
export type AddressRecord = {
  id: string; label: string; address: string; coordinates: Coordinates | null;
  source: 'demo' | 'manual' | 'legacy' | 'kakao';
  roadAddress?: string;
  jibunAddress?: string;
  placeUrl?: string;
  lookupType?: 'address' | 'place';
};
export type AddressId = string;
export const demoAddresses: AddressRecord[] = [
  { id: 'demo-mangwon', label: '예시 주소 A', address: '서울 마포구 포은로 일대', coordinates: { lat: 37.556, lng: 126.903 }, source: 'demo' },
  { id: 'demo-yeonhui', label: '예시 주소 B', address: '서울 서대문구 연희로 일대', coordinates: { lat: 37.568, lng: 126.930 }, source: 'demo' },
  { id: 'demo-eungam', label: '예시 주소 C', address: '서울 은평구 증산로 일대', coordinates: { lat: 37.591, lng: 126.914 }, source: 'demo' },
];
export const legacyAddresses: AddressRecord[] = [
  { id: 'mangwon', label: '기존 기록 · 망원1동', address: '마포구 망원1동 (상세 주소 미확인)', coordinates: null, source: 'legacy' },
  { id: 'yeonhui', label: '기존 기록 · 연희동', address: '서대문구 연희동 (상세 주소 미확인)', coordinates: null, source: 'legacy' },
  { id: 'eungam', label: '기존 기록 · 응암동', address: '은평구 응암동 (상세 주소 미확인)', coordinates: null, source: 'legacy' },
];
export {facilityCategories} from './facilities';
export const demoNotice = '주소·장소·주변 생활시설은 카카오맵에서 조회합니다. 대중교통은 ODsay로 조회하며 인증 설정이 필요합니다. 월세는 국토교통부 지역 실거래 참고 통계이며 인증 설정이 필요합니다. AI는 사용자가 선택한 주소의 실제 조회 근거를 요약합니다. 시설 분류는 카카오 등록 정보 기준이며 직선거리는 도보 거리가 아닙니다.';
