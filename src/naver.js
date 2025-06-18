/**
 * The Trail Manifest for our Mycelial-Naver system.
 * This object maps user-friendly paths to specific spore configurations.
 * This is the "DNA" of our Shell's navigation.
 */
export const trails = {
  // The default trail, shown on initial load
  '/': {
    name: 'spore-current-user',
    globalVar: 'SporeCurrentUser', // The window variable the spore exposes
    url: 'http://localhost:5175/spore.js', // The URL from the Rendezvous server
  },
  // The trail for registering a new user
  '/register': {
    name: 'spore-user-registration',
    globalVar: 'SporeUserRegistration',
    url: 'http://localhost:5174/spore.js',
  },
}
