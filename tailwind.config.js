/**
 * Palette inspired by a Nordic chainsaw sawmill:
 *   brand   – signal red (vertical posts, carriage) #e42313
 *   steel   – galvanised-steel silver for the frame
 *   motor   – deep royal blue from the mill motor
 *   forest  – pine green from the surrounding forest
 *   wood    – natural timber tones for the end-view illustration
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdecea',
          100: '#fbd3cf',
          200: '#f5a299',
          300: '#ef7263',
          400: '#ea4838',
          500: '#e42313', // primary signal red
          600: '#c01d10',
          700: '#991810',
          800: '#70120c',
          900: '#4a0c08'
        },
        steel: {
          50: '#f4f6f8',
          100: '#e6eaee',
          200: '#c8d0d8',
          300: '#a4afbb',
          400: '#7f8c9b',
          500: '#616e7c', // galvanised mid-grey
          600: '#4d5866',
          700: '#3a444f',
          800: '#262d36',
          900: '#141920'
        },
        motor: {
          50: '#eaf1fb',
          100: '#cddff5',
          200: '#9bbfea',
          300: '#5f9bdd',
          400: '#2f79cb',
          500: '#1a5ca8', // deep motor blue
          600: '#134785',
          700: '#0e3564',
          800: '#092344',
          900: '#051226'
        },
        forest: {
          50: '#eef5e8',
          100: '#d5e6c6',
          200: '#a9cc8d',
          300: '#7db154',
          400: '#559331',
          500: '#35671e', // accent / success
          600: '#2a5218',
          700: '#203d12',
          800: '#15290b',
          900: '#0a1505'
        },
        wood: {
          50: '#fdf8f3',
          100: '#f6e8d8',
          200: '#e9cba7',
          300: '#d6a874',
          400: '#c28850',
          500: '#a46a38',
          600: '#81532b',
          700: '#5f3d20',
          800: '#3f2815',
          900: '#23170b'
        }
      }
    }
  },
  plugins: []
};
