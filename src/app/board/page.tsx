import { redirect } from 'next/navigation';

// /board without a session ID is not a valid URL — redirect to home.
export default function BoardIndex() {
  redirect('/');
}
