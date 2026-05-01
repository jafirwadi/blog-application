// Modal functionality
class DeleteModal {
    constructor() {
        this.modal = null;
        this.deleteCallback = null;
        this.init();
    }

    init() {
        // Create modal HTML structure
        const modalHTML = `
            <div class="modal-overlay" id="deleteModal">
                <div class="modal-container">
                    <div class="modal-header">
                        <div class="modal-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 class="modal-title">Delete Post</h2>
                        <p class="modal-message">Are you sure you want to delete this post? This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-button modal-button-cancel" id="modalCancel">Cancel</button>
                        <button class="modal-button modal-button-delete" id="modalDelete">Delete</button>
                    </div>
                </div>
            </div>
        `;

        // Insert modal into body if it doesn't exist
        if (!document.getElementById('deleteModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.modal = document.getElementById('deleteModal');
        this.attachEventListeners();
    }

    attachEventListeners() {
        const cancelBtn = document.getElementById('modalCancel');
        const deleteBtn = document.getElementById('modalDelete');
        const overlay = this.modal;

        // Cancel button
        cancelBtn.addEventListener('click', () => this.close());

        // Delete button
        deleteBtn.addEventListener('click', () => {
            if (this.deleteCallback) {
                this.deleteCallback();
            }
            this.close();
        });

        // Close on overlay click (outside modal)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
    }

    open(callback) {
        this.deleteCallback = callback;
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
        this.deleteCallback = null;
    }
}

// Initialize modal when DOM is ready
let deleteModal;
document.addEventListener('DOMContentLoaded', () => {
    deleteModal = new DeleteModal();
});

// Global function for delete post (to be called from your template)
function deletePost(postID, redirectTo) {
    deleteModal.open(() => {
        // Show loading state (optional)
        const deleteBtn = document.getElementById('modalDelete');
        deleteBtn.textContent = 'Deleting...';
        deleteBtn.disabled = true;

        fetch(`/deletePost?id=${postID}`, {
            method: "DELETE"
        })
        .then(response => {
            if (response.ok) {
                window.location.href= redirectTo;
            } else {
                throw new Error('Delete failed');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to delete post. Please try again.');
            deleteBtn.textContent = 'Delete';
            deleteBtn.disabled = false;
        });
    });
}
