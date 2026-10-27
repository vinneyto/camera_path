use camera_path_sift::{GrayImage, Params, detect};
use clap::{Parser, ValueEnum};
#[derive(Clone, Copy, Debug, ValueEnum)]
enum Backend {
    Gpu,
    Cpu,
}
use std::{fs, path::PathBuf};
#[derive(Parser)]
#[command(about = "Notebook SIFT extrema detector (no orientations or descriptors)")]
struct Args {
    /// PNG/JPEG input. Use --gray-json for an exact normalized Python input.
    input: PathBuf,
    /// GPU uses native wgpu; CPU is for deterministic reference checks.
    #[arg(long, value_enum, default_value = "gpu")]
    backend: Backend,
    #[arg(short, long)]
    output: PathBuf,
    #[arg(long)]
    gray_json: bool,
    /// JSON object overriding detector defaults.
    #[arg(long)]
    params: Option<PathBuf>,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();
    let params: Params = if let Some(path) = args.params {
        serde_json::from_slice(&fs::read(path)?)?
    } else {
        Params::default()
    };
    let image = if args.gray_json {
        serde_json::from_slice::<GrayImage>(&fs::read(args.input)?)?
    } else {
        let im = image::open(args.input)?.to_rgba8();
        GrayImage::from_rgba(im.width() as usize, im.height() as usize, im.as_raw())?
    };
    let device = match args.backend {
        Backend::Gpu => burn::tensor::Device::wgpu_options().init()?,
        Backend::Cpu => burn::tensor::Device::flex(),
    };
    let start = std::time::Instant::now();
    let points = pollster::block_on(detect(&image, &params, &device))?;
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    fs::write(args.output, serde_json::to_vec_pretty(&points)?)?;
    eprintln!(
        "{} keypoints ({} × {}), {:.2} ms/detection, {:.2} detector FPS",
        points.len(),
        image.width,
        image.height,
        elapsed,
        1000.0 / elapsed
    );
    Ok(())
}
