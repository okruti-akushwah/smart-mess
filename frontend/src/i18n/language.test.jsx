// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LanguageProvider from './LanguageProvider';
import i18n from './i18n';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import MyPlans from '../pages/MyPlans';
import ChooseFood from '../pages/ChooseFood';
import MessDirectory from '../pages/MessDirectory';
import CustomerDashboard from '../pages/CustomerDashboard';
import OwnerDashboard from '../pages/OwnerDashboard';
import CustomerCheckout from '../pages/CustomerCheckout';
import DynamicText from '../components/DynamicText';
import WeeklyMenuEditor from '../components/WeeklyMenuEditor';
import {translateSaved} from '../services/dynamicTranslations';
vi.mock('../services/api',()=>({default:{get:vi.fn(async url=>({data:url==='/auth/signup/settings'?{demo_registration:true}:url==='/customer/account'?{mess_name:'Sharma Tiffin Centre',customer_name:'Customer',paused_dates:[]}:url==='/customer/activity'?{purchases:[]}:url==='/dashboard/headcount'?{preparation:[],latest_meals:[]}:[]}))},errorMessage:()=> 'Unable to load'}));
vi.mock('../services/dynamicTranslations',()=>({translateSaved:vi.fn()}));
function mount(children, route='/login'){return render(<MemoryRouter initialEntries={[route]}><LanguageProvider>{children}</LanguageProvider></MemoryRouter>);}
async function hindi(){fireEvent.change(screen.getByLabelText('भाषा / Language'),{target:{value:'hi'}});await waitFor(()=>expect(i18n.resolvedLanguage).toBe('hi'));}
beforeEach(async()=>{localStorage.clear();vi.clearAllMocks();await i18n.changeLanguage('en');});
afterEach(cleanup);
describe('live English/Hindi switching',()=>{
 it('shows one language selector on the public home page',()=>{
  mount(<MessDirectory/>, '/#find-mess');
  expect(screen.getAllByLabelText('भाषा / Language')).toHaveLength(1);
 });
 it('keeps the owner menu source unchanged while switching',async()=>{
  mount(<WeeklyMenuEditor/>);
  const input=await screen.findByRole('textbox',{name:'Menu Description'});
  fireEvent.change(input,{target:{value:'Brand paneer, dal, roti'}});await hindi();
  expect(input.value).toBe('Brand paneer, dal, roti');
  expect(screen.getByRole('textbox',{name:'मेन्यू की जानकारी'})).toBe(input);
  fireEvent.change(screen.getByLabelText('भाषा / Language'),{target:{value:'en'}});
  await waitFor(()=>expect(screen.getByRole('textbox',{name:'Menu Description'}).value).toBe('Brand paneer, dal, roti'));
 });
 it.each([
  [MessDirectory, 'अपना रोज़ का भोजन खोजें'],
  [ChooseFood, 'आपका अगला भोजन'],
  [CustomerDashboard, 'भोजन ऑर्डर करें'],
  [OwnerDashboard, 'भोजन, अतिथि और ऑर्डर। सब एक जगह।'],
  [CustomerCheckout, 'भुगतान पूरा करें'],
 ])('switches page labels without refreshing: %s',async(Component,hindiLabel)=>{
  mount(<Component/>,Component===MessDirectory?'/':'/login');await hindi();
  if(Component===CustomerDashboard){await screen.findByText('Sharma Tiffin Centre');expect(screen.getAllByText('भोजन ऑर्डर करें').length).toBeGreaterThan(0);}
  else await waitFor(()=>expect(screen.getAllByText(hindiLabel).length).toBeGreaterThan(0));
  fireEvent.change(screen.getByLabelText('भाषा / Language'),{target:{value:'en'}});
  await waitFor(()=>expect(i18n.resolvedLanguage).toBe('en'));
 });
 it('switches login labels, keeps entered values and restores English',async()=>{
  mount(<Login/>);
  const phone=screen.getByPlaceholderText('Enter your phone number');fireEvent.change(phone,{target:{value:'9876543210'}});
  await hindi();
  expect(screen.getByText('Smart Mess में लॉग इन करें')).toBeTruthy();
  expect(phone.value).toBe('9876543210');
  expect(localStorage.getItem('mess-language')).toBe('hi');expect(document.documentElement.lang).toBe('hi');
  fireEvent.change(screen.getByLabelText('भाषा / Language'),{target:{value:'en'}});
  await screen.findByText('Sign in to Smart Mess');expect(phone.value).toBe('9876543210');
 });
 it('updates registration and subscription pages',async()=>{
  const view=mount(<Signup/>);await hindi();await screen.findByText('Smart Mess से जुड़ें');view.unmount();
  mount(<MyPlans/>);
  await waitFor(()=>expect(screen.getAllByText('आपकी सदस्यताएँ').length).toBeGreaterThan(0));
 });
 it('translates saved content only in Hindi and restores its original immediately',async()=>{
  let finish;translateSaved.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  mount(<DynamicText kind="meal" id={12} field="menu_description" source="Dal and roti"/>);
  expect(translateSaved).not.toHaveBeenCalled();await hindi();
  await waitFor(()=>expect(translateSaved).toHaveBeenCalledOnce());finish('दाल और रोटी');await screen.findByText('दाल और रोटी');
  fireEvent.change(screen.getByLabelText('भाषा / Language'),{target:{value:'en'}});await screen.findByText('Dal and roti');
 });
 it('ignores a late Hindi response after switching back to English',async()=>{
  let finish;translateSaved.mockReturnValue(new Promise(resolve=>{finish=resolve;}));mount(<DynamicText kind="meal" id={12} field="menu_description" source="Dal and roti"/>);
  await hindi();await waitFor(()=>expect(translateSaved).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText('भाषा / Language'),{target:{value:'en'}});finish('दाल और रोटी');
  await waitFor(()=>expect(screen.getByText('Dal and roti')).toBeTruthy());
 });
});
