// Shared by the browser forms and the server. The server always re-validates.
export const usernameRule='영문 소문자로 시작하는 4~20자 (영문 소문자·숫자·밑줄)';
export const passwordRule='8~128자 · 아이디를 포함하지 않는 비밀번호';
const usernamePattern=/^[a-z][a-z0-9_]{3,19}$/;
const common=new Set(['password','password1','12345678','123456789','1234567890','qwerty123','qwertyuiop','11111111','00000000','abcd1234','iloveyou','admin1234','asdf1234','1q2w3e4r','1q2w3e4r5t','qwer1234','a1234567','zxcvbnm1']);
export function normalizeUsername(value:unknown){return typeof value==='string'?value.trim().toLowerCase():'';}
export function usernameError(username:string){return usernamePattern.test(username)?null:`아이디는 ${usernameRule}로 입력해 주세요.`;}
export function passwordError(password:unknown,username:string){
  if(typeof password!=='string'||password.length<8)return '비밀번호는 8자 이상이어야 합니다.';
  if(password.length>128)return '비밀번호는 128자 이하로 입력해 주세요.';
  if(username&&password.toLowerCase().includes(username))return '비밀번호에 아이디를 포함할 수 없습니다.';
  if(common.has(password.toLowerCase())||/^(.)\1+$/.test(password))return '너무 쉬운 비밀번호입니다. 다른 비밀번호를 사용해 주세요.';
  return null;
}
/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(value:unknown){
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.startsWith('/\\')||/[\r\n]/.test(value))return '/';
  return /^\/(login|signup)(\/|\?|$)/.test(value)?'/':value.slice(0,500);
}
