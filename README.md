# lstv-web
The LSTV website, built with EGV3 (Akeno) structure.

The website is entirely created from scratch, no templates, no libraries, and only using my own framework (LS for frontend and Akeno for backend).
It is a half-static and half-dynamic website.

The website utilizes a "single-page" application design throughout its entirety, meaning that all the required assets get preloaded (including the main document), and any other page is simply fetched afterwards and rendered dynmaically, without a page refresh.
This reduces bandwidth consumption, server load, browser overhead, and increases response time and speed of the website.
The backend is based and served on uWebSockets - meaning that performance is going to be top-notch.

**Copyright notice:**<br>
License: CC BY-NC-ND 4.0 - This project is not open source like most of my other projects.<br>
You are free to browse the code and make contributions, but you are not allowed to redistribute modified copies, and you must always include credit.
hi