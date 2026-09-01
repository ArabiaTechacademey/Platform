
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu.style.display === 'block') {
      mobileMenu.style.display = 'none';
    } else {
      mobileMenu.style.display = 'block';
    }
   }
// Desktop functionality
const buttons = document.querySelectorAll('.button');
const imageContainer = document.getElementById('imageContainer');
const displayedImage = document.getElementById('displayedImage');

// Mobile functionality
const mobileButtons = document.querySelectorAll('.mobile-button');
const mobileDisplayedImage = document.getElementById('mobileDisplayedImage');

// Image sources for each button
const imageSources = {
   login: "./ai.png",
   signup: "./web.png",
   notifications: "./cy.png",
};

// Desktop button click handler
buttons.forEach(button => {
   button.addEventListener('click', function() {
       // Button click animation
       this.style.transform = 'scale(0.95)';
       setTimeout(() => {
           this.style.transform = '';
       }, 150);
       
       // Get the image type from data attribute
       const imageType = this.getAttribute('data-image');
       
       // Set image source and show container
       if (imageType && imageSources[imageType]) {
           displayedImage.src = imageSources[imageType];
           imageContainer.style.display = 'block';
           
           // Scroll to the image if needed
           setTimeout(() => {
               imageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
           }, 100);
       }
   });
});

// Mobile button click handler
mobileButtons.forEach(button => {
   button.addEventListener('click', function() {
       // Remove active class from all buttons
       mobileButtons.forEach(btn => btn.classList.remove('active'));
       
       // Add active class to clicked button
       this.classList.add('active');
       
       // Button click animation
       this.style.transform = 'scale(0.95)';
       setTimeout(() => {
           this.style.transform = '';
       }, 150);
       
       // Get the image type from data attribute
       const imageType = this.getAttribute('data-mobile-image');
       
       // Set image source
       if (imageType && imageSources[imageType]) {
           mobileDisplayedImage.src = imageSources[imageType];
       }
   });
});

// Set the first mobile button as active by default
if (mobileButtons.length > 0) {
   mobileButtons[0].classList.add('active');
}


function changeImage(imageNum) {
   // Hide all images
   document.querySelectorAll('.hero-image img').forEach(img => {
       img.classList.add('hidden');
       img.classList.remove('visible');
   });
   
   // Show selected image
   const selectedImage = document.getElementById('image' + imageNum);
   selectedImage.classList.remove('hidden');
   selectedImage.classList.add('visible');
   
   // Update active feature card
   document.querySelectorAll('.feature-card').forEach((card, index) => {
       if (index === imageNum - 1) {
           card.classList.add('active');
       } else {
           card.classList.remove('active');
       }
   });
}
