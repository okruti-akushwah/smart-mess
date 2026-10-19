import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export default function RouteScroll() {
  const location = useLocation();
  const navigation = useNavigationType();
  const positions = useRef(new Map());
  const previous = useRef(null);

  useEffect(() => {
    const restoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = restoration; };
  }, []);

  useLayoutEffect(() => {
    const savedPositions = positions.current;
    const prior = previous.current;
    previous.current = location;
    const save = () => savedPositions.set(location.key, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    let observer;
    const hashId = location.hash.slice(1);
    const publicAnchor = ['visit', 'menu', 'about', 'preparation', 'reviews', 'how-it-works', 'find-mess'].includes(hashId);
    const managedMeal = location.pathname === '/customer' && /^meal-\d+$/.test(hashId);
    // Wait for public contact sections / booked meals behind asynchronous gates.
    // ChooseFood keeps its existing selected-meal handler.
    if (publicAnchor || managedMeal) {
      const reveal = () => {
        const target = document.getElementById(hashId);
        if (!target) return;
        target.scrollIntoView({ block: managedMeal ? 'center' : 'start', behavior: 'instant' });
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        observer?.disconnect();
      };
      observer = new MutationObserver(reveal);
      observer.observe(document.body, { childList: true, subtree: true });
      reveal();
    } else if (!location.hash) {
      const saved = navigation === 'POP' ? savedPositions.get(location.key) : undefined;
      if (saved !== undefined) {
        const restore = () => {
          window.scrollTo({ top: saved, left: 0, behavior: 'instant' });
          if (document.documentElement.scrollHeight >= saved + window.innerHeight) observer?.disconnect();
        };
        observer = new MutationObserver(restore);
        observer.observe(document.body, { childList: true, subtree: true });
        restore();
      } else if (!prior || prior.pathname !== location.pathname) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        let focused;
        const focusDestination = () => {
          const target = document.querySelector('main h1') || document.querySelector('main');
          if (!target || target === focused) return;
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
          focused = target;
        };
        // Public API loads and access/address gates may replace the loading main.
        // Follow that replacement only until the user's next interaction.
        observer = new MutationObserver(focusDestination);
        observer.observe(document.body, { childList: true, subtree: true });
        focusDestination();
      }
    }
    // Stop deferred restoration as soon as the user starts a new interaction.
    const stop = () => observer?.disconnect();
    const interactions = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    interactions.forEach(event => window.addEventListener(event, stop, { once: true, passive: true }));
    return () => {
      savedPositions.set(location.key, window.scrollY);
      window.removeEventListener('scroll', save);
      interactions.forEach(event => window.removeEventListener(event, stop));
      observer?.disconnect();
    };
  }, [location, navigation]);
  return null;
}
