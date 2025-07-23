# lstv-web
The LSTV website, built with Akeno.

The website is entirely created from scratch using HTML and CSS, no templates, no libraries, and only using my own tech stack (LS for frontend and Akeno for backend).
It is a half-static and half-dynamic website.

The website utilizes a "single-page" application design, meaning that all the required assets get preloaded (including the main document), and any other page is simply fetched afterwards and rendered dynamically, without a page refresh.
This reduces bandwidth consumption, server load, browser overhead, and increases response time and speed of the website.
The backend is based and served on uWebSockets - meaning that performance is going to be top-notch.

The website also includes a responsive design to ensure compatibility across various devices and screen sizes.

## Features
- Single-page application design
- Preloaded assets for faster performance
- Responsive design for various devices

## How to run locally
1. Clone the repository.
2. Install Akeno.
3. Point Akeno to the folder where you cloned the repository.
4. Start Akeno: `akeno start`.
5. Open the website in your browser.

## File structure
- `static/`: Contains site content.
- `assets/`: Contains assets like global css, js, and images.
- `templates/`: Contains templates used by the application.

## License
This project is licensed under the [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) license.

This project is not open source like most of my other projects.<br>
You are free to browse the code and make contributions, but you are not allowed to redistribute modified copies, and you must always include credit.