import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {MessagePlugin} from 'tdesign-react';
import * as model from './commerce-model.js';
import {validateState as legacyValid} from './business-model.js';

export const SAVE_KEY='shanye-merchant-unified-v1';
export const PAGE_NAMES={dashboard:'工作台',orders:'订单管理',verify:'验券入园',weigh:'采摘称重收款',drinks:'饮品制作',products:'商品管理',reservations:'预约容量',ledger:'经营账目',rewards:'推荐奖励',inventory:'库存管理',traffic:'流量概况',settings:'接入与设置'};
export const permissions={...model.allowedViews,owner:[...model.allowedViews.owner,'inventory','traffic']};
export const canView=(role,page)=>!!permissions[role]?.includes(page);
const BusinessContext=createContext(null);
const read=key=>{try{const s=JSON.parse(localStorage.getItem(key));return legacyValid(s)?(s.catalogVersion===2?(model.validateState(s)?s:null):model.upgradeState(s)):null;}catch{return null;}};
function load(){return read(SAVE_KEY)||read(model.STORAGE_KEY+'-classic')||read(model.STORAGE_KEY)||model.seed();}
export function BusinessProvider({children}){
  const [state,setState]=useState(load),[memoryOnly,setMemoryOnly]=useState(false);
  const [role,setRoleState]=useState(()=>{try{const r=sessionStorage.getItem('shanye-unified-role');return model.roles[r]?r:'owner';}catch{return 'owner';}});
  const ref=useRef(state),guards=useRef(new Map());
  function persist(next){ref.current=next;setState(next);try{localStorage.setItem(SAVE_KEY,JSON.stringify(next));}catch{setMemoryOnly(true);}}
  useEffect(()=>{try{const old=localStorage.getItem(SAVE_KEY);if(old&&!JSON.parse(old).catalogVersion&&!localStorage.getItem(SAVE_KEY+'-before-catalog-v2'))localStorage.setItem(SAVE_KEY+'-before-catalog-v2',old);localStorage.setItem(SAVE_KEY,JSON.stringify(ref.current));}catch{setMemoryOnly(true);}const listener=e=>{if(e.key===SAVE_KEY){const next=read(SAVE_KEY);if(next){ref.current=next;setState(next);}}};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener);},[]);
  function setRole(r){if(!model.roles[r])return;setRoleState(r);try{sessionStorage.setItem('shanye-unified-role',r);}catch{}}
  function run(fn,message,key,onError){
    if(key&&Date.now()-(guards.current.get(key)||0)<650)return null;
    try{const next=structuredClone((!memoryOnly&&read(SAVE_KEY))||ref.current),result=fn(next,role);if(!model.validateState(next))throw Error('演示存档格式无效');persist(next);if(key)guards.current.set(key,Date.now());if(message)MessagePlugin.success(message);return result===undefined?true:result;}
    catch(error){onError?.(error);MessagePlugin.warning(error.message);return null;}
  }
  function reset(){if(role!=='owner'){MessagePlugin.warning('仅老板可重置演示');return false;}guards.current.clear();persist(model.seed());MessagePlugin.success('已重置统一后台演示数据');return true;}
  return <BusinessContext.Provider value={{state,role,setRole,run,reset,memoryOnly}}>{children}</BusinessContext.Provider>;
}
export const useBusiness=()=>useContext(BusinessContext);
export function useSticky(key,fallback){
  const [value,setValue]=useState(()=>{try{const s=sessionStorage.getItem('shanye-ui-'+key);return s===null?fallback:JSON.parse(s);}catch{return fallback;}});
  useEffect(()=>{try{sessionStorage.setItem('shanye-ui-'+key,JSON.stringify(value));}catch{}},[key,value]);
  return [value,setValue];
}
export function readRoute(){
  let raw=location.hash.replace(/^#\/?/,'');
  if(!raw){try{raw=sessionStorage.getItem('shanye-unified-route')||'dashboard';}catch{raw='dashboard';}}
  const [page,query='']=raw.split('?');return {page:PAGE_NAMES[page]?page:'dashboard',params:new URLSearchParams(query)};
}
export function useMerchantRoute(role){
  const [route,setRoute]=useState(readRoute);
  useEffect(()=>{const update=()=>{const next=readRoute();setRoute(next);try{sessionStorage.setItem('shanye-unified-route',next.page+(next.params.size?'?'+next.params.toString():''));}catch{}};window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);
  function go(page,params={},replace=false){if(!canView(role,page)){MessagePlugin.warning('此页面不在当前岗位范围');return;}const qs=new URLSearchParams(params).toString(),hash='#/'+page+(qs?'?'+qs:'');if(location.hash===hash){setRoute(readRoute());return;}if(replace)location.replace(hash);else location.hash=hash;}
  useEffect(()=>{if(!canView(role,route.page)){location.replace('#/dashboard');setRoute({page:'dashboard',params:new URLSearchParams()});}},[role,route.page]);
  return [route,go];
}
