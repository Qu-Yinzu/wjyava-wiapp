/**
 * ui/contact.js
 * Client-side validation + mailto: handoff. Nothing is sent to a server.
 * All copy goes through i18n so the form follows the ID/EN switch.
 */

import { qs, createEl, setText } from '../core/dom.js';
import { t } from '../i18n/i18n.js';
import { announce } from './feedback.js';

const CONTACT_EMAIL = 'halo@wjyava.id';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function initContact() {
  const form = qs('[data-contact-form]');
  if (!form) return;

  const email = qs('#contact-email');
  const message = qs('#contact-message');
  const emailError = qs('[data-error-email]');
  const messageError = qs('[data-error-message]');
  const status = qs('[data-contact-status]');

  function setInvalid(field, errorEl, text) {
    field.setAttribute('aria-invalid', 'true');
    setText(errorEl, text);
  }

  function setValid(field, errorEl) {
    field.removeAttribute('aria-invalid');
    setText(errorEl, '');
  }

  function clearStatus() {
    setText(status, '');
  }

  email?.addEventListener('input', () => setValid(email, emailError));
  message?.addEventListener('input', () => setValid(message, messageError));

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const emailValue = email.value.trim();
    const messageValue = message.value.trim();
    let valid = true;

    if (!EMAIL_PATTERN.test(emailValue)) {
      valid = false;
      setInvalid(email, emailError, t('about.emailInvalid'));
    } else {
      setValid(email, emailError);
    }

    if (messageValue.length < 10) {
      valid = false;
      setInvalid(message, messageError, t('about.messageShort'));
    } else {
      setValid(message, messageError);
    }

    if (!valid) {
      setText(status, t('about.formInvalid'));
      announce(t('about.announceInvalid'));
      (email.getAttribute('aria-invalid') === 'true' ? email : message).focus();
      return;
    }

    const subject = t('about.subject');
    const body = `${t('about.bodyFrom', { email: emailValue })}\n\n${messageValue}`;
    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    clearStatus();
    setText(status, t('about.opening'));
    status.append(
      createEl('a', {
        href,
        text: t('about.mailtoFallback', { email: CONTACT_EMAIL })
      })
    );

    announce(t('about.announceOpening', { email: CONTACT_EMAIL }));
    window.location.href = href;
  });
}
