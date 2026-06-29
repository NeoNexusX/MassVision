# Viewing Data

Once a dataset is uploaded and analyzed, the result page in SpatialXomics gives you several linked views for exploring your mass spectrometry imaging data.

## Ion Image

- Renders the ion image for a selected m/z value, with scroll-wheel zoom and drag-to-pan.
- Switch colormaps (e.g. inferno) and intensity scale (linear / log), and fine-tune the displayed range with min/max sliders.

## Average Spectrum

- Shows the dataset's mean mass spectrum as a bar chart.
- Click a peak to switch the ion image to that m/z; conversely, clicking a point on the ion image updates the highlighted position in the spectrum.

## ROI Analysis

- Draw polygon regions of interest (ROIs) directly on the ion image, and adjust or confirm the selection.
- Use ROIs to focus further statistics or comparisons on a specific tissue region.

## UMAP / K-Means Cluster Overlay

- Loads the dataset's UMAP embedding and K-Means cluster labels (5 clusters by default) and renders them as a color overlay on the ion image, with an adjustable overlay opacity.
- Useful for quickly spotting groups of pixels with similar metabolic/chemical profiles within the same tissue section.

## Dataset Metadata

The result page also displays dataset metadata — name, analyzer type, ionization source, pixel size, polarity, spectrum mode, storage mode, and processing methods — so you can double-check the analysis parameters.

## Tips

- Selection between the ion image and the spectrum is bidirectional, making it easy to home in on an m/z of interest.
- ROI and cluster overlays can be enabled together; adjust layer order and opacity to get the clearest contrast.
