# Three.js Water Drop Effect

![Demo](output.gif)

A realistic rainy window effect built with Three.js and React Three Fiber. This project recreates the mesmerizing water droplet animations on glass surfaces using custom GLSL shaders.

**Inspired by [The Driver Home](https://thedriverhome.com/)** - A tribute to the beautiful rainy window effect from the original project, reimplemented using Three.js.

## Features

- Realistic water droplet physics with natural movement
- Multi-layered droplet system (small, medium, and large droplets)
- Trail effects following droplets as they flow down
- Refraction effect distorting the background image
- Smooth animations using custom GLSL shaders
- Responsive canvas rendering

## Tech Stack

- **Three.js** (v0.170.0) - 3D graphics library
- **React** (v18.3.1) - UI framework
- **React Three Fiber** (v8.17.10) - React renderer for Three.js
- **React Three Drei** (v9.117.3) - Useful helpers for R3F
- **Vite** - Build tool and dev server

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/threejs-water-drop.git

# Navigate to project directory
cd threejs-water-drop

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal).

### Build

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## How It Works

The effect is achieved through custom GLSL shaders that:

1. **Generate droplets**: Using noise functions to create randomized water droplet patterns at various scales
2. **Animate movement**: Simulating gravity by moving droplets down the screen over time
3. **Add trails**: Creating elongated trails behind falling droplets with smaller satellite droplets
4. **Apply refraction**: Distorting the background texture based on the water surface normals to simulate light refraction through water

The shader uses multiple layers with different scales to create depth and variety in droplet sizes.

## Project Structure

```
threejs-water-drop/
├── src/
│   ├── App.jsx          # Main application with shader implementation
│   └── main.jsx         # React entry point
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
└── vite.config.js       # Vite configuration
```

## Customization

You can adjust various parameters in `src/App.jsx`:

- **Layer intensities**: Modify `staticDrops`, `layer1`, `layer2`, `layer3` to control droplet density
- **Animation speed**: Change the multiplier in `float t = uTime * 0.2`
- **Background image**: Replace the Unsplash URL with your own image
- **Canvas size**: Adjust `planeGeometry args` in the Scene component

## Credits

- Original concept inspired by [The Driver Home](https://thedriverhome.com/)
- Developed using Three.js and React Three Fiber
- Background image from Unsplash

## License

MIT License - feel free to use this project for learning or personal projects.

---

Built with Three.js by recreating the beautiful rainy window aesthetic from The Driver Home.
